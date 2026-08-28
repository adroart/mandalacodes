#!/usr/bin/env bash
#
# go-live.sh — one interactive, idempotent, self-verifying pass through the
# credential-gated launch steps for the living-art-legacy system.
#
# Run this on YOUR machine (it needs your Cloudflare login). It is safe to
# re-run: migrations use IF NOT EXISTS + the D1 journal, secrets are only
# (re)set when you confirm, and every step verifies itself. Nothing here can
# corrupt the ledger — the write paths are idempotent or read-only.
#
# What it does automatically:  wrangler check, repo locate, login, migration
#   apply, secret generation + set on both Pages projects, live verification,
#   baseline backup.
# What it can NOT do (browser / other repo — printed at the end):  GitHub
#   mirror PAT, the Adrian-Website sender, and claiming light #1.
#
# Usage:
#   MC=/path/to/mandalacodes AW=/path/to/Adrian-Website bash scripts/go-live.sh
#   (or just run it and answer the prompts)

set -uo pipefail

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
ok()   { printf '\033[32m  ok  \033[0m %s\n' "$1"; }
warn() { printf '\033[33m warn \033[0m %s\n' "$1"; }
err()  { printf '\033[31m fail \033[0m %s\n' "$1"; }
ask()  { local a; read -r -p "$1 [y/N] " a; [[ "$a" == [yY] ]]; }

MC_PROJECT="mandalacodes"
DB="adrian-website"

# ----------------------------------------------------------------------------
bold "Step 0 — wrangler is installed and working"
# ----------------------------------------------------------------------------
if ! wrangler --version >/dev/null 2>&1; then
  warn "wrangler not found or broken (the npx cache error you hit)."
  echo "  Fix with:  npm install -g wrangler"
  echo "  Then re-run this script. (Do NOT use 'npx wrangler' — that cache is broken.)"
  exit 1
fi
ok "wrangler $(wrangler --version 2>/dev/null | head -1)"

# ----------------------------------------------------------------------------
bold "Step 1 — locate the two repos"
# ----------------------------------------------------------------------------
if [[ -z "${MC:-}" ]]; then
  MC="$(cd "$(dirname "$0")/.." && pwd)"   # this script lives in mandalacodes/scripts
fi
[[ -f "$MC/todo/handoff/adrian-website/003_atlas_legacy.sql" ]] \
  && ok "mandalacodes: $MC" \
  || { err "mandalacodes not found at MC=$MC"; exit 1; }

if [[ -z "${AW:-}" ]]; then
  AW="$(find "$HOME" -maxdepth 5 -type d -name 'Adrian-Website' -not -path '*/node_modules/*' 2>/dev/null | head -1)"
fi
if [[ -n "${AW:-}" && -d "$AW" ]]; then
  ok "Adrian-Website: $AW"
else
  warn "Adrian-Website checkout not found. Migrations must be applied from THAT"
  warn "repo (it owns the shared schema). Set AW=/path/to/Adrian-Website and re-run,"
  warn "or clone it first. Continuing — the migration step will be skipped."
  AW=""
fi

# ----------------------------------------------------------------------------
bold "Step 2 — Cloudflare login"
# ----------------------------------------------------------------------------
if wrangler whoami >/dev/null 2>&1; then
  ok "already logged in as $(wrangler whoami 2>/dev/null | grep -oE '[^ ]+@[^ ]+' | head -1)"
else
  echo "  Opening the browser login..."
  wrangler login || { err "login failed"; exit 1; }
fi

# ----------------------------------------------------------------------------
bold "Step 3 — D1 migrations (003_atlas_legacy + 004_piece_content)"
# ----------------------------------------------------------------------------
echo "  Read docs/d1-migrations.md first if you have not — both repos share this DB"
echo "  and D1 tracks migrations by FILENAME. Current journal state:"
wrangler d1 migrations list "$DB" --remote 2>&1 | sed 's/^/    /' || true
if [[ -n "$AW" ]] && ask "  Apply the two atlas migrations from the Adrian-Website checkout now?"; then
  mkdir -p "$AW/migrations"
  cp "$MC/todo/handoff/adrian-website/003_atlas_legacy.sql" "$AW/migrations/"
  cp "$MC/todo/handoff/adrian-website/004_piece_content.sql" "$AW/migrations/"
  ( cd "$AW" && wrangler d1 migrations apply "$DB" --remote )
else
  warn "skipped migration apply"
fi

echo "  Verifying the three tables exist..."
TABLES=$(wrangler d1 execute "$DB" --remote --json --command \
  "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('atlas_inscriptions','atlas_sale_events','atlas_piece_content');" 2>/dev/null \
  | grep -oE 'atlas_[a-z_]+' | sort -u | tr '\n' ' ')
for t in atlas_inscriptions atlas_sale_events atlas_piece_content; do
  [[ "$TABLES" == *"$t"* ]] && ok "table $t" || err "table $t MISSING — migration did not land"
done

# ----------------------------------------------------------------------------
bold "Step 4 — webhook secrets on both Pages projects"
# ----------------------------------------------------------------------------
echo "  The art-site Pages project is named:"
wrangler pages project list 2>/dev/null | sed 's/^/    /' || warn "could not list projects"
read -r -p "  Enter the Adrian-Website Pages project name (blank to skip secrets): " AW_PROJECT
if [[ -n "$AW_PROJECT" ]]; then
  if ask "  Generate NEW SALE_WEBHOOK_SECRET + CLAIM_BRIDGE_SECRET and set on both projects? (only say y if not already set — this rotates them)"; then
    SALE=$(openssl rand -hex 32); BRIDGE=$(openssl rand -hex 32)
    printf '%s' "$SALE"   | wrangler pages secret put SALE_WEBHOOK_SECRET --project-name "$MC_PROJECT"
    printf '%s' "$SALE"   | wrangler pages secret put SALE_WEBHOOK_SECRET --project-name "$AW_PROJECT"
    printf '%s' "$BRIDGE" | wrangler pages secret put CLAIM_BRIDGE_SECRET --project-name "$MC_PROJECT"
    printf '%s' "$BRIDGE" | wrangler pages secret put CLAIM_BRIDGE_SECRET --project-name "$AW_PROJECT"
    ok "secrets set on both projects (same value each) — redeploy both to pick them up"
    warn "store these in Infisical too so sync-secrets-to-cloudflare.sh stays authoritative"
  else
    warn "left existing secrets in place"
  fi
  echo "  Secrets currently on $MC_PROJECT:"
  wrangler pages secret list --project-name "$MC_PROJECT" 2>/dev/null | sed 's/^/    /' || true
fi

# ----------------------------------------------------------------------------
bold "Step 5 — live verification (proves migration + secret + deploy together)"
# ----------------------------------------------------------------------------
echo "  (If you just set secrets, redeploy both projects first, then re-run this step.)"
SALE_CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST https://mandalacodes.com/api/atlas/sale -H 'Content-Type: application/json' -d '{}')
case "$SALE_CODE" in
  401) ok  "/api/atlas/sale -> 401 (secret set, rejecting unsigned) — correct";;
  503) err "/api/atlas/sale -> 503 (SALE_WEBHOOK_SECRET still missing on mandalacodes, or redeploy pending)";;
  *)   warn "/api/atlas/sale -> $SALE_CODE (unexpected; investigate)";;
esac
PC=$(curl -s -w '\n%{http_code}' "https://mandalacodes.com/api/atlas/piece-content?pieceId=UL-100")
PC_CODE=$(printf '%s' "$PC" | tail -1)
case "$PC_CODE" in
  200) ok  "/api/atlas/piece-content -> 200 (migration 004 live)";;
  503) err "/api/atlas/piece-content -> 503 (migration 004 not applied)";;
  *)   warn "/api/atlas/piece-content -> $PC_CODE (unexpected)";;
esac

# ----------------------------------------------------------------------------
bold "Step 6 — baseline backup"
# ----------------------------------------------------------------------------
if ask "  Run npm run backup:atlas now? (errors on missing ledger/stewards are EXPECTED before your first steward)"; then
  ( cd "$MC" && npm run backup:atlas ) || warn "backup exited non-zero — expected on a fresh system with no ledger yet"
  warn "move any backups/atlas-* output offline; it contains collector contact info"
fi

# ----------------------------------------------------------------------------
bold "Remaining — manual, browser / other-repo (cannot be scripted)"
# ----------------------------------------------------------------------------
cat <<'MANUAL'
  A) GitHub mirror (external tamper evidence):
     1. Create a public repo, e.g. adroart/adrian-atlas-mirror
     2. Fine-grained PAT, Contents: Read/Write, that repo only
     3. Set on the mandalacodes Pages project, then redeploy:
          echo "<PAT>"                       | wrangler pages secret put GITHUB_MIRROR_TOKEN --project-name mandalacodes
          echo "owner/adrian-atlas-mirror"   | wrangler pages secret put GITHUB_MIRROR_REPO  --project-name mandalacodes
          echo "atlas/public.json"           | wrangler pages secret put GITHUB_MIRROR_PATH  --project-name mandalacodes

  B) Adrian-Website sender (in that repo):
       cp "$MC/todo/handoff/adrian-website/notify-mandalacodes.ts" <Adrian-Website>/functions/_lib/
     Then call, from the Stripe checkout-success handler:
       context.waitUntil(notifyMandalacodesOfSale(env, sale))
     Contract + payload fields: todo/handoff/adrian-website/sale-webhook-spec.md

  C) Claim light #1 (the launch, in the browser as you):
     Sign in to mandalacodes.com -> /admin/atlas -> issue/confirm your own
     steward record -> open your piece's page -> claim -> say YES to the map
     -> write the first inscription. You are light #1.

  Then: /admin/piece-content is live for writing the 64 stories whenever you want.
MANUAL

bold "Done. Re-run this script any time; it only acts where you confirm."
