#!/usr/bin/env python3
"""Deploy and inspect this OpenSEO service through Render's public API.

Example: python3 deploy/render/manage.py --env-file ../.env --state ../reports/render-state.json create
Credentials are read from disk, sent only to Render, and never printed.
"""
import argparse
import json
import re
import secrets
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def read_env(path):
    values = {}
    for line in path.read_text().splitlines():
        match = re.match(r"^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$", line)
        if match:
            value = match[2].strip()
            if len(value) > 1 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            values[match[1]] = value
    return values


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, required=True)
    parser.add_argument("--state", type=Path, required=True)
    parser.add_argument("--repo", default="https://github.com/leo1aimpact/propagated-openseo")
    parser.add_argument("--name", default="propagated-openseo")
    parser.add_argument("--region", default="singapore")
    parser.add_argument("--plan", default="1c-2g")
    parser.add_argument("--commit")
    parser.add_argument("--domain", default="seo.propagated.ai")
    parser.add_argument("action", choices=["create", "status", "logs", "deploy", "restart", "add-domain", "verify-domain"])
    args = parser.parse_args()
    values = read_env(args.env_file)

    def request(path, method="GET", payload=None):
        req = urllib.request.Request("https://api.render.com/v1/" + path,
            data=json.dumps(payload).encode() if payload is not None else None,
            method=method, headers={"Authorization": "Bearer " + values["RENDER_API_KEY"],
            "Accept": "application/json", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                body = response.read()
                return json.loads(body) if body else {}
        except urllib.error.HTTPError as error:
            message = error.read().decode()
            for value in values.values():
                if len(value) > 10:
                    message = message.replace(value, "[redacted]")
            raise SystemExit(f"Render HTTP {error.code}: {message}") from None

    state = json.loads(args.state.read_text()) if args.state.exists() else {}
    if args.action == "create":
        for key in ["DATAFORSEO_API_KEY", "TEAM_DOMAIN", "POLICY_AUD"]:
            if not values.get(key):
                raise SystemExit(f"Set {key} in the environment file before creating the service")
        owners = request("owners?limit=100")
        if len(owners) != 1:
            raise SystemExit("Expected one Render workspace; choose the owner explicitly before proceeding")
        owner_id = owners[0]["owner"]["id"]
        existing = request("services?" + urllib.parse.urlencode({"name": args.name, "ownerId": owner_id, "limit": 100}))
        matches = [row["service"] for row in existing if row["service"]["name"] == args.name]
        if matches:
            service = matches[0]
            if service.get("repo") != args.repo:
                raise SystemExit("A different repository already owns this service name")
        else:
            for key in ["RENDER_MAINTENANCE_KEY", "BETTER_AUTH_SECRET"]:
                if not values.get(key):
                    values[key] = secrets.token_hex(32)
                    with args.env_file.open("a") as file:
                        file.write(f"\n{key}={values[key]}\n")
                    args.env_file.chmod(0o600)
            app_values = {key: values[key] for key in ["DATAFORSEO_API_KEY", "TEAM_DOMAIN", "POLICY_AUD",
                "RENDER_MAINTENANCE_KEY", "BETTER_AUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET",
                "AI_PROVIDER", "OPENAI_API_KEY", "OPENAI_MODEL",
                "ANTHROPIC_API_KEY", "ANTHROPIC_MODEL", "OPENROUTER_API_KEY", "OPENROUTER_MODEL"] if values.get(key)}
            app_values.update(AUTH_MODE="cloudflare_access", CLOUDFLARE_INCLUDE_PROCESS_ENV="true",
                OPENSEO_TELEMETRY_DISABLED="1", VITE_SHOW_DEVTOOLS="false", PORT="10000")
            body = {"type": "web_service", "name": args.name, "ownerId": owner_id,
                "repo": args.repo, "branch": "main", "autoDeploy": "no",
                "envVars": [{"key": key, "value": value} for key, value in app_values.items()],
                "serviceDetails": {"runtime": "docker", "plan": args.plan, "region": args.region,
                    "numInstances": 1, "healthCheckPath": "/healthz",
                    "disk": {"name": "openseo-state", "mountPath": "/app/.wrangler", "sizeGB": 1},
                    "envSpecificDetails": {"dockerfilePath": "./Dockerfile.render", "dockerContext": "."}}}
            result = request("services", "POST", body)
            service = result.get("service", result)
        state = {"serviceId": service["id"], "ownerId": owner_id, "name": args.name,
            "repo": args.repo, "region": args.region, "url": service.get("serviceDetails", {}).get("url")}
        args.state.parent.mkdir(parents=True, exist_ok=True)
        args.state.write_text(json.dumps(state, indent=2) + "\n")
        print(json.dumps(state, indent=2))
        return
    sid = state["serviceId"]
    if args.action == "status":
        service = request(f"services/{sid}")
        deploys = request(f"services/{sid}/deploys?limit=3")
        print(json.dumps({"service": {key: service.get(key) for key in ["id", "name", "suspended", "serviceDetails"]},
            "deploys": deploys}, indent=2))
    elif args.action == "logs":
        result = request("logs?" + urllib.parse.urlencode({"ownerId": state["ownerId"], "resource": sid,
            "limit": 50, "direction": "backward"}))
        for row in reversed(result.get("logs", [])):
            message = row.get("message", "")
            for value in values.values():
                if len(value) > 10:
                    message = message.replace(value, "[redacted]")
            print(message)
    elif args.action == "deploy":
        print(json.dumps(request(f"services/{sid}/deploys", "POST",
            {"commitId": args.commit} if args.commit else {}), indent=2))
    elif args.action == "restart":
        print(json.dumps(request(f"services/{sid}/restart", "POST"), indent=2))
    elif args.action == "verify-domain":
        domain = urllib.parse.quote(args.domain, safe="")
        request(f"services/{sid}/custom-domains/{domain}/verify", "POST")
        print(json.dumps(request(f"services/{sid}/custom-domains/{domain}"), indent=2))
    elif args.action == "add-domain":
        domains = request(f"services/{sid}/custom-domains")
        if any(row.get("customDomain", row).get("name") == args.domain for row in domains):
            print("Custom domain already attached")
        else:
            print(json.dumps(request(f"services/{sid}/custom-domains", "POST", {"name": args.domain}), indent=2))


if __name__ == "__main__":
    main()
