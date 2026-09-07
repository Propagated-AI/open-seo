#!/usr/bin/env python3
"""Provision the private Access application, then its Render CNAME.

The token needs Access Apps/Policies Edit, Access Organizations/Identity
Providers/Groups Edit, DNS Edit, and Zone Read for the selected resources.
No token is copied into the deployed application.
"""
import argparse
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from manage import read_env


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, required=True)
    parser.add_argument("--state", type=Path, required=True)
    parser.add_argument("--zone", default="propagated.ai")
    parser.add_argument("--domain", default="seo.propagated.ai")
    parser.add_argument("--team-name", default="propagated-openseo")
    parser.add_argument("--emails", nargs="+")
    parser.add_argument("--render-host")
    parser.add_argument("action", choices=["inspect", "provision", "dns"])
    args = parser.parse_args()
    values = read_env(args.env_file)
    token = values.get("CLOUDFLARE_API_TOKEN")
    if not token:
        raise SystemExit("Save CLOUDFLARE_API_TOKEN in the environment file first")

    def request(path, method="GET", body=None):
        req = urllib.request.Request("https://api.cloudflare.com/client/v4/" + path,
            data=json.dumps(body).encode() if body is not None else None, method=method,
            headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                result = json.load(response)
        except urllib.error.HTTPError as error:
            message = error.read().decode().replace(token, "[redacted]")
            raise SystemExit(f"Cloudflare HTTP {error.code}: {message}") from None
        if not result.get("success"):
            raise SystemExit(json.dumps(result.get("errors", [])).replace(token, "[redacted]"))
        return result["result"]

    configured_account = values.get("CLOUDFLARE_ACCOUNT_ID")
    if token.startswith("cfat_"):
        if not configured_account:
            raise SystemExit("Set CLOUDFLARE_ACCOUNT_ID for this account-owned token")
        verification = request(f"accounts/{configured_account}/tokens/verify")
        if verification.get("status") != "active":
            raise SystemExit("The Cloudflare account token is not active")

    zones = request("zones?" + urllib.parse.urlencode({"name": args.zone, "status": "active"}))
    if len(zones) != 1:
        raise SystemExit("Expected exactly one active zone matching the requested domain")
    zone = zones[0]
    zone_id, account_id = zone["id"], zone["account"]["id"]
    if configured_account and account_id != configured_account:
        raise SystemExit("The requested zone belongs to a different Cloudflare account")
    prefix = f"accounts/{account_id}/access"
    state = json.loads(args.state.read_text()) if args.state.exists() else {}
    if args.action == "dns":
        if not args.render_host or not args.render_host.endswith(".onrender.com"):
            raise SystemExit("Supply the verified Render hostname using --render-host")
        records = request(f"zones/{zone_id}/dns_records?" + urllib.parse.urlencode({"name": args.domain}))
        if records:
            if len(records) != 1 or records[0].get("type") != "CNAME" or records[0].get("content") != args.render_host:
                raise SystemExit("Existing DNS record differs; inspect it before making changes")
            record = records[0]
            if not record.get("proxied"):
                record = request(f"zones/{zone_id}/dns_records/{record['id']}", "PATCH", {"proxied": True})
        else:
            record = request(f"zones/{zone_id}/dns_records", "POST", {
                "type": "CNAME", "name": args.domain, "content": args.render_host,
                "proxied": True, "ttl": 1, "comment": "Private OpenSEO dashboard on Render"})
        state.update(dnsRecordId=record["id"], renderHost=args.render_host)
    else:
        # An empty list indicates Access has not yet been configured. Errors
        # are left visible rather than guessing permission failures mean absence.
        organization = request(prefix + "/organizations")
        providers = request(prefix + "/identity_providers")
        applications = request(prefix + "/apps?per_page=100")
        if args.action == "inspect":
            print(json.dumps({"zoneId": zone_id, "accountId": account_id,
                "teamDomain": organization.get("auth_domain") if organization else None,
                "providers": [{"id": p["id"], "name": p.get("name"), "type": p.get("type")} for p in providers],
                "matchingApps": [{"id": app["id"], "name": app.get("name"), "domain": app.get("domain")} for app in applications if app.get("domain") == args.domain]}, indent=2))
            return
        if not args.emails or any(not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email) for email in args.emails):
            raise SystemExit("Supply the exact approved email addresses using --emails")
        if not organization:
            organization = request(prefix + "/organizations", "POST", {
                "name": "Propagated team", "auth_domain": args.team_name + ".cloudflareaccess.com"})
        provider = next((p for p in providers if p.get("type") == "onetimepin"), None)
        if not provider:
            provider = request(prefix + "/identity_providers", "POST", {
                "name": "OpenSEO email PIN", "type": "onetimepin", "config": {}})
        matches = [app for app in applications if app.get("domain") == args.domain]
        policy = {"name": "OpenSEO approved team", "decision": "allow", "precedence": 1,
            "include": [{"email": {"email": email}} for email in args.emails], "exclude": [], "require": []}
        if matches:
            if len(matches) != 1 or matches[0].get("name") != "Propagated OpenSEO":
                raise SystemExit("Another Access application already uses this domain")
            app = request(prefix + "/apps/" + matches[0]["id"])
            actual = request(prefix + "/apps/" + app["id"] + "/policies")
            expected_emails = set(args.emails)
            if len(actual) != 1 or actual[0].get("decision") != "allow" or set(
                    rule.get("email", {}).get("email") for rule in actual[0].get("include", [])) != expected_emails:
                raise SystemExit("Existing application's policies differ; inspect before changing access")
        else:
            app = request(prefix + "/apps", "POST", {"name": "Propagated OpenSEO", "type": "self_hosted",
                "domain": args.domain, "session_duration": "24h", "allowed_idps": [provider["id"]],
                "auto_redirect_to_identity": True, "http_only_cookie_attribute": True,
                "same_site_cookie_attribute": "lax", "policies": [policy]})
        team_domain = "https://" + organization["auth_domain"].removeprefix("https://")
        state.update(zoneId=zone_id, accountId=account_id, applicationId=app["id"], domain=args.domain,
            teamDomain=team_domain, audience=app["aud"], approvedEmails=args.emails)
        text = args.env_file.read_text()
        for key, value in {"TEAM_DOMAIN": team_domain, "POLICY_AUD": app["aud"]}.items():
            pattern = rf"(?m)^{key}\s*=.*$"
            text = re.sub(pattern, lambda _: f"{key}={value}", text) if re.search(pattern, text) else text.rstrip() + f"\n{key}={value}\n"
        args.env_file.write_text(text)
        args.env_file.chmod(0o600)
    args.state.parent.mkdir(parents=True, exist_ok=True)
    args.state.write_text(json.dumps(state, indent=2) + "\n")
    print(json.dumps(state, indent=2))


if __name__ == "__main__":
    main()
