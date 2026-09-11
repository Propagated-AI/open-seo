import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import manage


class Response(io.BytesIO):
    def __init__(self, data):
        super().__init__(json.dumps(data).encode())


class RenderManagementTests(unittest.TestCase):
    def run_create(self, existing=None, owners=None):
        folder = tempfile.TemporaryDirectory()
        self.addCleanup(folder.cleanup)
        env = Path(folder.name) / ".env"
        env.write_text("RENDER_API_KEY=render-secret\nDATAFORSEO_API_KEY=data-secret\n"
            "TEAM_DOMAIN=https://test.cloudflareaccess.com\nPOLICY_AUD=audience\n"
            "AI_PROVIDER=openai\nOPENAI_API_KEY=ai-secret\nOPENAI_MODEL=test-model\n"
            "ANTHROPIC_API_KEY=anthropic-secret\nANTHROPIC_MODEL=other-model\n"
            "OPENROUTER_API_KEY=router-secret\nOPENROUTER_MODEL=provider/model\n"
            "UNRELATED_API_KEY=must-not-be-deployed\n")
        state = Path(folder.name) / "state.json"
        requests = []

        def urlopen(request, **_):
            requests.append(request)
            if "/owners?" in request.full_url:
                return Response(owners if owners is not None else [{"owner": {"id": "tea-test"}}])
            if request.method == "GET":
                return Response(existing or [])
            return Response({"service": {"id": "srv-test", "serviceDetails": {"url": "https://test.onrender.com"}}})

        argv = ["manage.py", "--env-file", str(env), "--state", str(state), "create"]
        output = io.StringIO()
        with patch("sys.argv", argv), patch("urllib.request.urlopen", urlopen), contextlib.redirect_stdout(output):
            manage.main()
        return requests, json.loads(state.read_text()), output.getvalue()

    def test_creation_keeps_unrelated_and_management_secrets_out_of_app(self):
        requests, state, output = self.run_create()
        payload = json.loads(requests[-1].data)
        values = {entry["key"]: entry["value"] for entry in payload["envVars"]}
        self.assertNotIn("RENDER_API_KEY", values)
        self.assertNotIn("UNRELATED_API_KEY", values)
        self.assertEqual(values["AUTH_MODE"], "cloudflare_access")
        self.assertEqual(payload["serviceDetails"]["disk"]["mountPath"], "/app/.wrangler")
        self.assertEqual(payload["autoDeploy"], "no")
        self.assertGreaterEqual(len(values["RENDER_MAINTENANCE_KEY"]), 32)
        self.assertEqual(state["serviceId"], "srv-test")
        self.assertNotIn("data-secret", output)
        self.assertNotIn("render-secret", output)
        self.assertEqual(values["AI_PROVIDER"], "openai")
        self.assertEqual(values["OPENAI_API_KEY"], "ai-secret")
        self.assertEqual(values["ANTHROPIC_API_KEY"], "anthropic-secret")
        self.assertEqual(values["OPENROUTER_MODEL"], "provider/model")
        self.assertNotIn("ai-secret", output)

    def test_existing_matching_service_is_not_created_again(self):
        requests, state, _ = self.run_create(existing=[{"service": {
            "name": "propagated-openseo", "repo": "https://github.com/leo1aimpact/propagated-openseo", "id": "srv-existing"}}])
        self.assertTrue(all(request.method == "GET" for request in requests))
        self.assertEqual(state["serviceId"], "srv-existing")

    def test_name_collision_with_another_repository_fails(self):
        with self.assertRaisesRegex(SystemExit, "different repository"):
            self.run_create(existing=[{"service": {
                "name": "propagated-openseo", "repo": "https://github.com/example/unrelated", "id": "srv-unrelated"}}])

    def test_ambiguous_workspace_fails_before_service_creation(self):
        with self.assertRaisesRegex(SystemExit, "one Render workspace"):
            self.run_create(owners=[{"owner": {"id": "one"}}, {"owner": {"id": "two"}}])


if __name__ == "__main__":
    unittest.main()
