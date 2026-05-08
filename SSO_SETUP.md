# SSO Setup Guide (Phase 3)

This dashboard uses **OpenID Connect** for sign-in. Any OIDC-compliant identity provider works — Google Workspace, Microsoft Entra ID (Azure AD), Atlassian Access, Okta, Keycloak. IT only needs to register an OAuth client and plug the resulting credentials into a few env vars.

---

## What you'll deliver to IT

> Hi IT, please register a new OAuth/OIDC client for our internal worklog dashboard.
>
> - **Application type:** Web application
> - **Sign-in redirect URI:** `https://dev.famrut.com/famrut-team-logs/api/auth/callback.php`
> - **Sign-out URI** *(optional)*: `https://dev.famrut.com/famrut-team-logs/logs/login`
> - **Scopes:** `openid email profile`
> - **Allowed user domains:** `@esds.co.in` (and any other ESDS domains)
>
> Once registered, please send me:
>
> - Client ID
> - Client Secret
> - The provider's authorization, token, and userinfo endpoints (or a "discovery URL" — I can derive the rest)

---

## Apache configuration

Once you have the credentials, set them as environment variables on the web server. The cleanest way for Apache is to add a `SetEnv` block in the `<VirtualHost>` (or `.conf` include) that serves `dev.famrut.com`:

```apache
SetEnv OIDC_ENABLED         true
SetEnv OIDC_CLIENT_ID       "REPLACE_WITH_CLIENT_ID"
SetEnv OIDC_CLIENT_SECRET   "REPLACE_WITH_CLIENT_SECRET"
SetEnv OIDC_AUTH_URL        "https://accounts.google.com/o/oauth2/v2/auth"
SetEnv OIDC_TOKEN_URL       "https://oauth2.googleapis.com/token"
SetEnv OIDC_USERINFO_URL    "https://openidconnect.googleapis.com/v1/userinfo"
SetEnv OIDC_REDIRECT_URI    "https://dev.famrut.com/famrut-team-logs/api/auth/callback.php"
SetEnv OIDC_SCOPES          "openid email profile"
SetEnv OIDC_ALLOWED_DOMAINS "esds.co.in"
SetEnv OIDC_INITIAL_ADMIN   "akash.wagh@esds.co.in"
SetEnv APP_URL              "/famrut-team-logs/logs/"

# After your first SSO admin login + at least one manager user, flip this to true
# to lock down the Phase 2 endpoints (issues.php / worklogs.php / users.php).
SetEnv AUTH_REQUIRED        false
```

Reload Apache (`apachectl graceful`) for env vars to take effect.

> **Important:** The user whose email matches `OIDC_INITIAL_ADMIN` becomes the bootstrap admin on their first SSO login. Choose carefully — they will be the only person who can grant other admin/manager roles.

---

## Provider presets

### Google Workspace

```apache
SetEnv OIDC_AUTH_URL     "https://accounts.google.com/o/oauth2/v2/auth"
SetEnv OIDC_TOKEN_URL    "https://oauth2.googleapis.com/token"
SetEnv OIDC_USERINFO_URL "https://openidconnect.googleapis.com/v1/userinfo"
```

Registration: <https://console.cloud.google.com/apis/credentials> → "Create Credentials" → "OAuth client ID" → "Web application".

### Microsoft Entra ID (Azure AD)

```apache
SetEnv OIDC_AUTH_URL     "https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/authorize"
SetEnv OIDC_TOKEN_URL    "https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/token"
SetEnv OIDC_USERINFO_URL "https://graph.microsoft.com/oidc/userinfo"
```

Registration: Entra admin centre → "App registrations" → "New registration".

### Atlassian Access

```apache
SetEnv OIDC_AUTH_URL     "https://auth.atlassian.com/authorize"
SetEnv OIDC_TOKEN_URL    "https://auth.atlassian.com/oauth/token"
SetEnv OIDC_USERINFO_URL "https://api.atlassian.com/me"
SetEnv OIDC_SCOPES       "openid email profile"
```

Registration: Atlassian developer console → "Create" → "OAuth 2.0 (3LO)".

### Okta

```apache
SetEnv OIDC_AUTH_URL     "https://<OKTA_DOMAIN>/oauth2/default/v1/authorize"
SetEnv OIDC_TOKEN_URL    "https://<OKTA_DOMAIN>/oauth2/default/v1/token"
SetEnv OIDC_USERINFO_URL "https://<OKTA_DOMAIN>/oauth2/default/v1/userinfo"
```

---

## Local testing without IT

Until IT comes back with credentials, the app keeps working:

- **SSO tab** on the login page shows "SSO not yet configured".
- **Local** tab still accepts the legacy management passwords (from `ConfigContext`).
- **Jira Token** tab still accepts the per-employee Atlassian API token flow.

So you can demo Phase 1 + 2 to stakeholders without blocking on IT.

---

## Rollout checklist

Once Apache env vars are set and reloaded:

1. Visit `https://dev.famrut.com/famrut-team-logs/api/auth/me.php` — should return JSON with `oidcEnabled: true, oidcConfigured: true`.
2. Visit the SPA's login page → click **Sign in with ESDS SSO**.
3. Complete the flow at the IdP. You should land back on the dashboard.
4. Hit the new **User Management** menu (admin only) — you should see yourself listed with role `admin`.
5. Add one or two managers + assign them a project scope.
6. Have those managers log in via SSO to confirm.
7. Once everyone has logged in at least once, flip `AUTH_REQUIRED=true` and reload Apache. From now on:
   - Anonymous requests to `issues.php`, `worklogs.php`, `users.php` get **401**.
   - Only authenticated SSO sessions can fetch Jira data.

That's Phase 3 done. Phase 4 will add server-side scope enforcement (so that even a manager who knows another team's project key can't see their data).

---

## Troubleshooting

- **`bad_state` after SSO redirect** — usually means cookies aren't preserved between the browser and your IdP. Ensure the dashboard is served over HTTPS (the session cookie has `Secure` set) and that `SameSite=Lax` is honoured.
- **`domain_not_allowed`** — the email returned by the IdP isn't in `OIDC_ALLOWED_DOMAINS`. Either add the domain or use a different account.
- **`/api/auth/me.php` always says authenticated:false** — most likely Apache is running PHP under a config without sessions. Check `session_save_path` is writable.
- **CORS errors after enabling SSO** — the new endpoints set CORS headers based on `Origin`. If you're hitting them from a different origin than the SPA, add it to `OIDC_ALLOWED_DOMAINS` and ensure your reverse proxy doesn't strip the `Cookie` header.
