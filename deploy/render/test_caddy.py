"""Exercise the actual Render gateway with harmless loopback test backends.

Run with CADDY_BINARY=/path/to/caddy python3 -m unittest discover
-s deploy/render -p test_caddy.py. Ports 3101 and 3102 must be free.
"""
import base64
import hashlib
import http.server
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request


class Backend(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_GET(self):
        if self.path == '/_internal/access-check':
            status = 200 if self.headers.get('Cf-Access-Jwt-Assertion') == 'test-grant' else 401
            if status == 200 and self.headers.get('Upgrade'):
                status = 400  # Auth checks must remain ordinary HTTP requests.
            self.send_response(status)
            self.end_headers()
            return
        if self.path == '/agents/test/connection' and self.headers.get('Upgrade', '').lower() == 'websocket':
            accept = base64.b64encode(hashlib.sha1((self.headers['Sec-WebSocket-Key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').encode()).digest()).decode()
            self.send_response(101)
            self.send_header('Upgrade', 'websocket')
            self.send_header('Connection', 'Upgrade')
            self.send_header('Sec-WebSocket-Accept', accept)
            self.end_headers()
            self.wfile.write(b'\x81\x02ok')
            return
        self.send_response(200)
        self.end_headers()
        self.wfile.write(json.dumps(dict(self.headers)).encode())


@unittest.skipUnless(os.environ.get('CADDY_BINARY'), 'Set CADDY_BINARY to test the gateway')
class GatewayTest(unittest.TestCase):
    def test_public_origin_and_access_gate(self):
        servers = []
        process = None
        with tempfile.TemporaryDirectory() as temp:
            try:
                for port in [3101, 3102]:
                    server = http.server.ThreadingHTTPServer(('127.0.0.1', port), Backend)
                    servers.append(server)
                    threading.Thread(target=server.serve_forever, daemon=True).start()
                with socket.socket() as probe:
                    probe.bind(('127.0.0.1', 0))
                    gateway_port = probe.getsockname()[1]
                env = dict(os.environ, PORT=str(gateway_port), XDG_CONFIG_HOME=temp, XDG_DATA_HOME=temp)
                config = Path(__file__).with_name('Caddyfile').resolve()
                with open(Path(temp) / 'caddy.log', 'w') as log:
                    process = subprocess.Popen([env['CADDY_BINARY'], 'run', '--config', str(config), '--adapter', 'caddyfile'], env=env, stdout=log, stderr=log)
                    for _ in range(50):
                        try:
                            with socket.create_connection(('127.0.0.1', gateway_port), timeout=0.1):
                                break
                        except OSError:
                            time.sleep(0.1)
                    for path in ['/api/health', '/_ops/status']:
                        url = f'http://127.0.0.1:{gateway_port}{path}'
                        headers = {'Host': 'seo.example.com', 'X-Forwarded-Proto': 'http', 'X-Forwarded-Host': 'untrusted.example', 'Authorization': 'Bearer not-for-backend', 'X-Render-Maintenance-Key': 'not-for-app'}
                        with self.assertRaises(urllib.error.HTTPError) as denied:
                            urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=5)
                        self.assertEqual(denied.exception.code, 401)
                        denied.exception.close()
                        headers['Cf-Access-Jwt-Assertion'] = 'test-grant'
                        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=5) as response:
                            received = {k.lower(): v for k, v in json.load(response).items()}
                        self.assertEqual(received['x-forwarded-proto'], 'https')
                        self.assertEqual(received['x-forwarded-host'], 'seo.example.com')
                        self.assertNotIn('authorization', received)
                        if path.startswith('/api/'):
                            self.assertEqual(received['host'], 'localhost:3101')
                            self.assertNotIn('x-render-maintenance-key', received)
                    for authorized in [False, True]:
                        with socket.create_connection(('127.0.0.1', gateway_port), timeout=5) as ws:
                            token = 'Cf-Access-Jwt-Assertion: test-grant\r\n' if authorized else ''
                            ws.sendall((f'GET /agents/test/connection HTTP/1.1\r\nHost: seo.example.com\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n{token}\r\n').encode())
                            response = b''
                            while b'\r\n\r\n' not in response:
                                chunk = ws.recv(4096)
                                if not chunk:
                                    break
                                response += chunk
                            self.assertIn(b' 101 ' if authorized else b' 401 ', response.split(b'\r\n')[0])
                            if authorized:
                                while b'\x81\x02ok' not in response:
                                    chunk = ws.recv(4096)
                                    if not chunk:
                                        break
                                    response += chunk
                                self.assertIn(b'\x81\x02ok', response)
            finally:
                if process:
                    process.terminate()
                    process.wait(timeout=10)
                for server in servers:
                    server.shutdown()
                    server.server_close()
