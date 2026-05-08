# SSO Setup Guide (Phase 3)

This dashboard uses **OpenID Connect** for sign-in. Any OIDC-compliant identity provider works — Google Workspace, Microsoft Entra ID (Azure AD), Atlassian Access, Okta, Keycloak. IT only needs to register an OAuth client and plug the resulting credentials into a few env vars.

---

## What you'll deliver to IT

> Hi IT, please register a new OAuth/OIDC client for our internal worklog dashboard.
>
> - **Application type:** Web application
> - **Sign-in redirect URI:** `https://dev.famrut.com/esds-worklogs/jira-api/auth/callback.php`
> - **Sign-out URI** *(optional)*: `https://dev.famrut.com/esds-worklogs/login`
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
SetEnv OIDC_REDIRECT_URI    "https://dev.famrut.com/esds-worklogs/jira-api/auth/callback.php"
SetEnv OIDC_SCOPES          "openid email profile"
SetEnv OIDC_ALLOWED_DOMAINS "esds.co.in"
SetEnv OIDC_INITIAL_ADMIN   "akash.wagh@esds.co.in"
SetEnv APP_URL              "/esds-worklogs/"

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

1. Visit `https://dev.famrut.com/esds-worklogs/jira-api/auth/me.php` — should return JSON with `oidcEnabled: true, oidcConfigured: true`.
2. Visit the SPA's login page → click **Sign in with ESDS SSO**.
3. Complete the flow at the IdP. You should land back on the dashboard.
4. Hit the new **User Management** menu (admin only) — you should see yourself listed with role `admin`.
5. Add one or two managers + assign them a project scope.
6. Have those managers log in via SSO to confirm.
7. Once everyone has logged in at least once, flip `AUTH_REQUIRED=true` and reload Apache. From now on:
   - Anonymous requests to `issues.php`, `worklogs.php`, `users.php` get **401**.
   - Only authenticated SSO sessions can fetch Jira data.

That's Phase 3 done. Phase 4 (below) adds server-side scope enforcement and an audit log on top.

---

## Phase 4 — Server-side scope enforcement + audit log

After Phase 3 you can _assign_ a scope to a user. Phase 4 _enforces_ it. Even a determined manager who hand-crafts a JQL query against another team's project key will only see issues from their own scope. Every privileged action is also recorded in an append-only audit log.

### What gets enforced

Every request to `issues.php`, `worklogs.php`, and `users.php` now:

1. Looks up the calling user's scope (admin sets this via the **User Management** page).
2. Wraps any caller-supplied JQL with `project IN (<scope>) AND (...)` — the server forces the intersection.
3. Drops out-of-scope issue keys from bulk worklog requests (and logs `worklogs.scope_filtered`).
4. 403s outright if a single-issue worklog request is for an issue outside scope.
5. Clamps `?projects=...` on the users endpoint to the intersection of the requested list and the user's scope.

Admins (`scope.projects = "*"`) bypass these clamps.

> Scope enforcement is gated on `AUTH_REQUIRED=true`. While `AUTH_REQUIRED=false` (the default during rollout), endpoints behave exactly like Phase 2.

### Audit log

Stored as JSONL at `jira-api/audit.log` (gitignored, blocked by `.htaccess`, auto-rotated at 10 MB).
Actions recorded:

| Action                     | When                                                           |
|----------------------------|----------------------------------------------------------------|
| `login_sso`                | Successful SSO callback                                        |
| `logout`                   | Session destroyed                                              |
| `issues.fetch`             | Every JQL search; details include raw + scoped JQL, row counts |
| `worklogs.fetch_single`    | Single-issue worklog read                                      |
| `worklogs.fetch_bulk`      | Bulk worklog read                                              |
| `worklogs.scope_denied`    | Single-issue request for an out-of-scope issue (403)           |
| `worklogs.scope_filtered`  | Bulk request that contained out-of-scope keys (silently dropped)|
| `users.fetch`              | Distinct-employee discovery                                    |
| `admin.user_upsert`        | Admin created or updated a user                                |
| `admin.user_update`        | Admin patched a user (role / scope)                            |
| `admin.user_delete`        | Admin deleted a user                                           |
| `*.error`                  | Any caught exception during the above                          |

Admins view the log in-app at **Admin → Audit Log** (`/admin/audit`). Filters: action type, user email, row limit.

### Verifying the wiring

1. Make sure `AUTH_REQUIRED=true` is set in Apache.
2. Sign in as admin. Add a manager with `scope: ["FAMRUT"]`.
3. Sign in as that manager (separate browser / private window).
4. Open DevTools → Network and try forcing a JQL on another project, e.g.:
   - Type a custom JQL in the dashboard like `project = OCAC-FUP` — server returns issues from `FAMRUT ∩ OCAC-FUP` (i.e. nothing).
   - Single-issue worklog: `GET /api/worklogs.php?issueKey=OCAC-FUP-1` → **403**.
5. Sign back in as admin → **Audit Log** → confirm the events show with `worklogs.scope_denied` and the manager's email.

### Smoke test (CLI)

```bash
php jira-api/smoke_phase4.php
```

Runs the unit-style tests for `applyScopeToJql`, `applyScopeToProjectList`, `isIssueKeyInScope`, and the audit-log roundtrip. Refuses to run over HTTP.

### Operational notes

- **Rotating audit log**: at 10 MB the active file is renamed to `audit.log.<epoch>`. The viewer tails only the active file; older files are kept on disk for forensic retention.
- **Storage**: file-based by default for self-contained deployment. **Phase 5 below** adds an opt-in DB backing store (SQLite or MySQL) plus per-user rate limiting.
- **Scope strings**: prefer Jira project KEYS (e.g. `FAMRUT`) over project NAMES — the JQL clause is more efficient and the issue-key-prefix check in `isIssueKeyInScope` matches keys exactly.

---

## Phase 5 — Database backing + rate limiting

Phase 4 left the user store and audit log as files (`users.json`, `audit.log`). That works on a single host but doesn't scale across multiple PHP workers, can't survive a disk wipe, and gives no protection against runaway scripts. Phase 5 adds:

- An opt-in **database** (SQLite for dev, MySQL / Postgres for prod). When DB is on, the user store and audit log live in tables with proper indexes and retention policies.
- **Per-user, per-endpoint rate limiting** (default 120 requests/minute). Returns `429 Too Many Requests` with a `Retry-After` header; the frontend shows a non-blocking warning toast.
- A **migration CLI** (`php jira-api/migrate.php`) that creates the schema and one-shot imports existing `users.json` + `audit.log` content.

Everything is **opt-in**. With no DB env vars set, the app behaves exactly like Phase 4.

### Storage architecture

```
auth_helper.php        → policy + middleware (unchanged surface)
user_store.php         → CRUD with file driver OR DB driver (auto-select)
audit_store.php        → log writes/reads with file driver OR DB driver
rate_limit_helper.php  → per-bucket counters, atomic UPSERT (DB) or flock'd JSON (file)
db.php                 → PDO singleton + portable schema emitter
migrate.php            → CLI: init / status / import / prune / all
```

### Quick start (local dev with SQLite)

```bash
# Apache SetEnv equivalent — for local CLI testing:
export DB_DSN="sqlite:$(pwd)/jira-api/data.db"

# Create tables and migrate any existing file-based data:
php jira-api/migrate.php all

# Verify:
php jira-api/migrate.php status
# Output:
#   users: N rows
#   audit_events: N rows
#   rate_limits: 0 rows
```

The SQLite file (`data.db`) is gitignored. From this point on every audit event and user mutation goes to the DB. Existing `users.json` / `audit.log` files become read-only fallbacks (you can delete them once you're confident).

### Production (MySQL)

```apache
# In your Apache vhost or .htaccess (must be host-level):
SetEnv DB_DSN  "mysql:host=localhost;dbname=esds_worklog;charset=utf8mb4"
SetEnv DB_USER esds_worklog
SetEnv DB_PASS s3cret

# Optional retention windows
SetEnv DB_AUDIT_RETENTION_DAYS       365
SetEnv DB_RATE_LIMIT_RETENTION_HOURS 24

# Rate limits (per user, per endpoint, per minute)
SetEnv RATE_LIMIT_PER_MINUTE 120
SetEnv RATE_LIMIT_DISABLED   false
```

```bash
# Create the DB on the MySQL server first:
mysql> CREATE DATABASE esds_worklog DEFAULT CHARACTER SET utf8mb4;
mysql> CREATE USER 'esds_worklog'@'localhost' IDENTIFIED BY 's3cret';
mysql> GRANT ALL PRIVILEGES ON esds_worklog.* TO 'esds_worklog'@'localhost';

# Then migrate:
php jira-api/migrate.php all
```

### Postgres (also supported)

```apache
SetEnv DB_DSN "pgsql:host=localhost;port=5432;dbname=esds_worklog"
SetEnv DB_USER esds_worklog
SetEnv DB_PASS s3cret
```

`migrate.php` emits Postgres-compatible DDL (uses `TEXT` instead of `LONGTEXT`).

### Rate limiting

- Bucket key: `<endpoint>:<userOrIp>:<minute>`
- Default cap: **120 / minute / user / endpoint**. Override with `RATE_LIMIT_PER_MINUTE`.
- `RATE_LIMIT_DISABLED=true` turns off enforcement entirely (counters still track but never 429).
- Every 429 writes an audit event `ratelimit.exceeded` with the user, endpoint, and current count — visible in the **Audit Log** page.
- Response includes `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After`.
- The frontend's axios interceptor dispatches a `app:ratelimit` window event; `NotificationContext` shows a yellow toast with the retry hint.

### Retention / cleanup

`php jira-api/migrate.php prune` deletes rows older than the configured retention windows. Run it from cron / Task Scheduler:

```cron
# Daily at 02:00 — keep 365 days of audit, 24h of rate-limit buckets
0 2 * * *  php /var/www/esds-worklogs/jira-api/migrate.php prune >> /var/log/esds-worklog-prune.log 2>&1
```

The `rate_limits` table also self-cleans opportunistically (1% of write requests sweep expired buckets).

### Smoke test

```bash
php jira-api/smoke_phase5.php
```

17 assertions covering DB bootstrap, user CRUD, audit roundtrip, rate-limit accept/deny. Refuses to run over HTTP.

### Switching from file → DB live

1. Set `DB_DSN` (and `DB_USER` / `DB_PASS` for MySQL) in Apache and reload.
2. Run `php migrate.php all` once.
3. The next request that hits any endpoint will see `db()` return a PDO; user_store and audit_store auto-route to the DB. No code change needed.
4. After verifying for a day, optionally delete `users.json` and `audit.log` from disk. They are no longer authoritative.

To roll back: unset `DB_DSN`, reload Apache. Stores fall back to file mode immediately. (You'll lose any users / events that were created in the DB after migration; export from DB first if needed.)

### Admin UX additions

- `/api/auth/me.php` now includes a `backend` block when an admin is signed in:
  ```json
  "backend": {
    "db": { "enabled": true, "driver": "sqlite" },
    "authRequired": true,
    "rateLimitPerMin": 120,
    "rateLimitOff": false
  }
  ```
  Useful for sanity-checking that prod is in the right mode without SSH.

---

## Troubleshooting

- **`bad_state` after SSO redirect** — usually means cookies aren't preserved between the browser and your IdP. Ensure the dashboard is served over HTTPS (the session cookie has `Secure` set) and that `SameSite=Lax` is honoured.
- **`domain_not_allowed`** — the email returned by the IdP isn't in `OIDC_ALLOWED_DOMAINS`. Either add the domain or use a different account.
- **`/api/auth/me.php` always says authenticated:false** — most likely Apache is running PHP under a config without sessions. Check `session_save_path` is writable.
- **CORS errors after enabling SSO** — the new endpoints set CORS headers based on `Origin`. If you're hitting them from a different origin than the SPA, add it to `OIDC_ALLOWED_DOMAINS` and ensure your reverse proxy doesn't strip the `Cookie` header.
- **Scope clamp returns nothing for a manager** (Phase 4) — confirm their `scope.projects` actually contains the project KEY/NAME the dashboard is querying. Visit `Admin → User Management`, click their scope, and re-save with the right keys.
- **`Admin → Audit Log` is empty** — file probably hasn't been written yet (no privileged actions). Try a sign-in or a JQL query, then refresh the page. If still empty, check that `jira-api/` is writable by the PHP process.
- **`migrate.php` says `DB_DSN is not configured`** — env var didn't reach PHP CLI. On Apache hosting, `SetEnv` only affects HTTP requests; for cron / CLI you need to export the variable in the shell or pass it inline (`DB_DSN=... php migrate.php all`).
- **MySQL: `SQLSTATE[42000] Specified key was too long`** — happens on old MySQL (<5.7.7) without `innodb_large_prefix`. Switch to InnoDB Barracuda format, or run on MySQL 5.7+.
- **Rate limit hit accidentally** — bump `RATE_LIMIT_PER_MINUTE`, or set `RATE_LIMIT_DISABLED=true` and reload. Counters use minute windows, so a misbehaving script self-recovers within 60s.
