# Connect Google Search Console and Analytics to OpenSEO

Status: draft walkthrough; checked against Google documentation and the pinned application code on 8 September 2026. The instructor's complete consent and live-data flow has not yet been verified. Do not label this exercise fully tested until its checkpoints pass.

## Outcome and prerequisites

You will create one Google OAuth client, install its credentials on Render, and authorize two separate read-only connections. Cloudflare continues to control dashboard login. Search Console supplies search-performance data; Analytics supplies data from an existing GA4 property. Enabling APIs alone does not create either property or install website tracking.

Use your own Google account, Cloud project, website properties, and deployment URL. A named company account is a suitable administrator. An email alias is not a separate Google login. Record these values before beginning:

| Your value | Example used below |
| --- | --- |
| Cloud project name | My OpenSEO |
| Google account that will grant data access | you@example.com |
| Dashboard origin, with no trailing slash | https://seo.example.com |
| Registered domain | example.com |

The account granting consent must already have access to the required Search Console and GA4 properties. The Cloud project administrator and consenting account can differ.

## 1. Confirm the project and enabled APIs

Open [Google Cloud Console](https://console.cloud.google.com/). Check the account avatar at the top right. Use the project selector in the top bar to select your OpenSEO project.

Open the top-left navigation menu → **APIs & Services → Enabled APIs & services**. Confirm these three names appear: **Google Search Console API**, **Google Analytics Admin API**, and **Google Analytics Data API**. To add a missing one, choose **Enable APIs and services**, search its exact name, open its result, and click **Enable**.

**Checkpoint:** All three APIs are enabled in the same project that you will use below.

## 2. Open Google Auth Platform

Open the top-left navigation menu → **Google Auth Platform → Branding**. Alternatively, open [Google Auth Platform](https://console.cloud.google.com/auth/overview) and check the selected project again.

If the page says the platform is not configured, click **Get started**. If you already see an existing app configuration, inspect its Branding and Audience settings instead of creating a second project.

## 3. Complete the first-time wizard

Fill in the wizard in this order:

| Screen | Entry or action |
| --- | --- |
| App Information | App name: **My OpenSEO**. User support email: select a monitored address offered by Google. Click **Next**. |
| Audience | Choose **Internal** for accounts in the project's Workspace/Cloud Identity organization. Otherwise choose **External**. Click **Next**. |
| Contact Information | Enter your monitored administrator email. Click **Next**. |
| Finish | Read the displayed Google API Services User Data Policy. If you agree, select its checkbox, click **Continue**, then **Create**. |

Internal may be unavailable when the project has no Google organization. Students using personal Gmail accounts follow the External branch. Choosing External does not make the dashboard public; Cloudflare still restricts access.

**Checkpoint:** The platform navigation now includes Branding, Audience, Clients, and Data Access. The correct app name is saved.

Official references: [first-time wizard](https://developers.google.com/workspace/guides/configure-oauth-consent) and [platform overview](https://support.google.com/cloud/answer/15544987).

## 4. Set audience and domain details

For **External / Testing**, open **Audience**, locate **Test users**, click **Add users**, enter each Google account that will connect data, and click **Save**. Internal apps do not use this test-user list. External testing grants for these scopes expire after seven days; plan the appropriate production setup before relying on unattended refreshes. See [audience rules](https://support.google.com/cloud/answer/15549945).

Open **Branding**. Under **Authorized domains**, click **Add domain**, enter `example.com`, and save. Use the registered domain without `https://` or a path. A dashboard at `seo.example.com` uses `example.com` here. If Google requires ownership verification, complete that for your own domain. Do not invent home-page or privacy-policy URLs if additional fields are required. External production branding and verification are a separate publication checkpoint. See [branding fields](https://support.google.com/cloud/answer/15549049).

## 5. Declare read-only data scopes

For the External branch, open **Data Access → Add or remove scopes**. Select the two data permissions below, using the search/filter or manual-entry area if necessary. Retain the basic identity scopes used by OpenSEO. Apply the selection with **Update**, then **Save** if shown.

```text
openid
https://www.googleapis.com/auth/userinfo.email
https://www.googleapis.com/auth/userinfo.profile
https://www.googleapis.com/auth/webmasters.readonly
https://www.googleapis.com/auth/analytics.readonly
```

The application requests `email` and `profile` as the identity-scope aliases, and requests the appropriate data scope separately for each connector. Internal apps do not need an external consent-screen scope declaration, but their actual requests must still match the permissions above. This exercise needs neither Gmail mailbox access nor Analytics/Search Console write access.

**Checkpoint:** The requested data permissions end in `readonly`. If the picker has no relevant data scopes, return to Step 1 and check the project and enabled APIs. See [scope configuration](https://support.google.com/cloud/answer/15549135).

## 6. Create the web OAuth client

Open **Clients → Create client**. Set **Application type** to **Web application** and name it **OpenSEO Render**.

Under **Authorized redirect URIs**, click **Add URI** twice. Enter the two full callback URLs for your deployment:

```text
https://seo.example.com/api/gsc/oauth/callback
https://seo.example.com/api/ga4/oauth/callback
```

Leave **Authorized JavaScript origins** empty for this server-side connector. Do not put callback URLs in that field. Click **Create**. Securely save the client ID and client secret while the creation dialog provides them; use its download option if offered. Treat downloaded credential JSON as a secret.

**Checkpoint:** The client is a Web application, and its details show both exact redirect URIs. No extra slash follows `callback`. See [web client creation](https://developers.google.com/workspace/guides/create-credentials).

## 7. Configure Render

Open Render → your OpenSEO service → **Environment → Edit**. Add:

```dotenv
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

Preserve the existing `BETTER_AUTH_SECRET`; existing encrypted tokens depend on it. Save the environment changes and use Render's save/redeploy action. Wait for the service to become live, then reload OpenSEO. A local `.env` change alone does not update a running Render deployment. In the instructor-led version, the instructor can install these two values through the existing deployment API instead.

**Checkpoint:** Both Google integration cards stop reporting that the OAuth client is missing. Keep credentials out of screenshots, student materials, and Git.

## 8. Connect and verify real properties

Open the dashboard through its Cloudflare-protected custom hostname and sign in as an approved dashboard user. In your website project, click **Connect** on Search Console. Choose the intended Google account, review the read-only consent request, and select the correct website property when offered. Then connect Google Analytics separately from **Project settings → Analytics → Connect with Google** and choose the existing GA4 property.

**Checkpoint:** Record the connected property names, selected reporting date range, and observed data. An empty report can mean no data in that range; it does not alone prove a failed connection. Confirm the same property and date range in Google's own interface before diagnosing a discrepancy. Test reconnecting and confirm that disconnecting one connector does not disconnect the other.

## Troubleshooting and lab evidence

| Symptom | Next check |
| --- | --- |
| No Get started button | An app may already exist; inspect Branding and Audience. |
| Support email is missing | Select an eligible address offered for the signed-in account. An arbitrary alias is not automatically eligible. |
| Internal unavailable or org_internal error | Check project organization and membership of the account granting consent. |
| External test user denied | Add the actual Google login under Audience → Test users. |
| redirect_uri_mismatch | Compare Google's rejected URI with the client's registered URI, character for character; also check deployment public-origin forwarding. |
| Client still not configured | Check Render environment, successful deployment, and page reload. |
| No properties listed | Check the consenting account's property access and that the required APIs are enabled. |
| Connection expires after a week | Check whether the OAuth app is External / Testing. |

For publication, capture redacted screenshots of the project selector, enabled APIs, each wizard screen, audience branch, scope list, client type and callback fields, environment variable names, consent screens, and successful property selection. Record the date and any label differences. Do not record secrets, authorization codes, or tokens. Keep this walkthrough marked draft until a fresh learner can complete both the Internal or External path applicable to them and the live connection checkpoints.

## Instructor verification update — 8 September 2026

Installing the Google credentials on Render and redeploying cleared both missing-client warnings. Opening Search Console authorization exposed an HTTP callback despite the HTTPS public domain. Caddy overwrote the forwarded scheme because its connection from Render is HTTP. A local fix explicitly sets the protected upstream protocol to HTTPS. One real-Caddy integration test and ten public-origin/OAuth tests passed. The owner approved publication on 9 September 2026. Fix commit `87ded526a67412a25217978cae7875262b55f3f4` was deployed successfully on 9 September 2026. Public readiness and access-protection checks passed. Browser verification was blocked by another Chrome extension popup; Google consent, token exchange, and property data remain for user testing. Preserve the HTTPS callback URLs in Google rather than registering an insecure HTTP workaround.

## Follow-up — 9 September 2026

The next live attempt revealed `https://localhost:3101/api/ga4/oauth/callback`. The HTTPS scheme was now correct, but Vite combined it with the gateway's internal Host. The public-origin helper now recognizes HTTPS loopback requests and recovers the trusted forwarded hostname. Public HTTPS origins still ignore forwarded-host overrides. Regression tests cover loopback host variants and both Google connectors. Do not register localhost:3101 in the production Google client. Both production callbacks must use the public HTTPS hostname.

The dashboard now uses the supplied Propagated.ai black favicon by default and its white version when the browser reports a dark color preference. This preference follows the browser/OS setting, and may differ from a custom browser toolbar theme.
