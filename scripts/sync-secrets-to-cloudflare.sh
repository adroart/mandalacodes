#!/usr/bin/env bash
# Sync Infisical secrets → Cloudflare Pages environment variables.
#
# Run with: infisical run --env=prod --path=/ -- bash scripts/sync-secrets-to-cloudflare.sh
#
# Infisical injects the named vars below into the script's process env, and
# we shove each one into Cloudflare Pages via `wrangler pages secret put`.
# No values touch disk; the keys never leave the encrypted channel between
# Infisical and the local process.
#
# Add or remove names in SECRETS_TO_SYNC below as the project grows. The
# script prints names and statuses only — never values.
set -euo pipefail

# ─── Configure ─────────────────────────────────────────────────────────────
PROJECT_NAME="mandalacodes"

# Plaintext vars (visible in dashboard, NOT encrypted). Configuration and
# public identifiers — no real secrets here. (Auth moved in-house to Better
# Auth; there is no Vite publishable key anymore.)
PLAINTEXT_VARS=(
  "ADMIN_EMAILS"
  # Better Auth public configuration.
  "BETTER_AUTH_URL"
  "RESEND_FROM_EMAIL"
  "GOOGLE_CLIENT_ID"          # OAuth client id is public by design
  # Public GitHub mirror configuration (docs/secrets-sync.md): repo + path
  # are configuration, not secrets. Only public.json is ever mirrored.
  "GITHUB_MIRROR_REPO"
  "GITHUB_MIRROR_PATH"
)

# Encrypted vars (real secrets). Stored encrypted at rest in Cloudflare.
ENCRYPTED_VARS=(
  # Self-owned Better Auth (replaced Clerk).
  "BETTER_AUTH_SECRET"
  "RESEND_API_KEY"
  "GOOGLE_CLIENT_SECRET"
  # Sale → ledger bridge (M4): HMAC secret shared with adrianrasmussen.com —
  # the SAME value must be set on that Pages project too (this script only
  # syncs mandalacodes; see todo/handoff/adrian-website/sale-webhook-spec.md).
  "SALE_WEBHOOK_SECRET"
  # Fine-grained GitHub PAT for the public-state mirror (_mirror.ts).
  "GITHUB_MIRROR_TOKEN"
  # Optional bearer token gating /api/oracle/recommendation.
  "ORACLE_API_TOKEN"
)

# ─── Pre-flight ────────────────────────────────────────────────────────────
if ! command -v wrangler &>/dev/null; then
  echo "wrangler not on PATH. Try: npx wrangler" >&2
  exit 1
fi

# Ensure we're inside an Infisical-injected process. The exact var names below
# are required-to-be-set; this catches the "ran without infisical run" mistake.
if [[ -z "${BETTER_AUTH_SECRET:-}" || -z "${BETTER_AUTH_URL:-}" || -z "${ADMIN_EMAILS:-}" ]]; then
  cat >&2 <<'EOF'
Missing one of the required env vars in this process.

This script must be run via Infisical, like so:
  infisical run --env=prod --path=/ -- bash scripts/sync-secrets-to-cloudflare.sh

Infisical injects the secret values into the process; this script only reads
them and forwards them to Cloudflare Pages. If a var is missing, add it to
the mandalacodes Infisical project first.
EOF
  exit 1
fi

echo "Syncing secrets to Cloudflare Pages project: $PROJECT_NAME"
echo ""

# ─── Plaintext vars ────────────────────────────────────────────────────────
for name in "${PLAINTEXT_VARS[@]}"; do
  value="${!name:-}"
  if [[ -z "$value" ]]; then
    echo "  [skip] $name (no value in Infisical)"
    continue
  fi
  echo "  [plaintext] $name → mandalacodes/production"
  # `wrangler pages secret put` always treats the value as encrypted, so we
  # use the dashboard or `wrangler pages deployment` for true plaintext vars.
  # For now: store plaintext vars as encrypted too — it works, it's just
  # slightly over-secured. The dashboard UI still shows the name.
  printf '%s' "$value" | wrangler pages secret put "$name" --project-name "$PROJECT_NAME" >/dev/null
done

# ─── Encrypted vars ────────────────────────────────────────────────────────
for name in "${ENCRYPTED_VARS[@]}"; do
  value="${!name:-}"
  if [[ -z "$value" ]]; then
    echo "  [skip] $name (no value in Infisical)"
    continue
  fi
  echo "  [encrypted] $name → mandalacodes/production"
  printf '%s' "$value" | wrangler pages secret put "$name" --project-name "$PROJECT_NAME" >/dev/null
done

echo ""
echo "Done. Cloudflare will use the new values on the next deploy."
echo "Trigger a deploy via:"
echo "  wrangler pages deployment create --project-name $PROJECT_NAME --branch main"
echo "or push to main, or click Retry deploy in the Pages dashboard."
