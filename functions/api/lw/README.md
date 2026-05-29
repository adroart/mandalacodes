# Lightweaver Relay — one-time setup

The relay endpoints under `/api/lw/*` use Cloudflare KV to bridge cards on
home networks with customer browsers anywhere on the internet. KV is free
for low traffic. Setup is two commands.

## 1. Create the KV namespace

From the `mandalacodes/` directory:

```bash
npx wrangler kv:namespace create LIGHTWEAVER_RELAY
```

The output looks like:

```
🌀 Creating namespace with title "mandalacodes-LIGHTWEAVER_RELAY"
✨ Success!
Add the following to your wrangler.toml...
{ binding = "LIGHTWEAVER_RELAY", id = "abc123def456..." }
```

Copy the `id` value (the long hex string).

## 2. Paste it into `wrangler.toml`

In the project root `wrangler.toml`, find the existing `[[kv_namespaces]]`
block for `LIGHTWEAVER_RELAY` and replace the placeholder with the real id:

```toml
[[kv_namespaces]]
binding = "LIGHTWEAVER_RELAY"
id = "abc123def456..."   # the value from step 1
```

Commit and push. Cloudflare Pages will pick up the binding on the next deploy.

As of 2026-05-29, `led.mandalacodes.com` is attached to the separate
Cloudflare Pages project named `lightweaver` because DNS already points at
`lightweaver-edw.pages.dev`. Deploy this repo's built `dist/` + Functions
bundle there with:

```bash
wrangler pages deploy dist --project-name lightweaver --branch main
```

The `lightweaver` Pages project also needs the same `LIGHTWEAVER_RELAY` KV
binding in its production and preview deployment configs.

## What the endpoints do

| Method + path | Caller | Purpose |
|---|---|---|
| `POST /api/lw/register` | Card | First boot: get ownerToken + pair code |
| `POST /api/lw/heartbeat` | Card | Every 15s: post current state |
| `GET  /api/lw/poll/:id` | Card | Every 1s: read pending command |
| `POST /api/lw/poll/:id` | Card | Ack applied command by `commandId`; clears pending |
| `POST /api/lw/pair` | Browser | Submit 6-char code, receive token |
| `POST /api/lw/control/:id` | Browser | Write a command bundle |
| `GET  /api/lw/state/:id` | Browser | Read card's last state |

## Pricing

- KV free tier: 100k reads, 1k writes, 1k deletes per day
- A card heartbeating every 15s = ~5.7k writes/day per card (well under free)
- A card polling every 1s = ~86k reads/day per card

For a single test card you're fine. For 100 customer cards you'll exceed
free-tier reads; either move to the paid plan ($5/month for 10M reads) or
extend the poll interval to 5s and the heartbeat to 30s — same effective
latency, 10x fewer requests.
