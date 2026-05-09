# Demo Script

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

## Main evaluator scenario: Friday Office Dessert Drop

The repo now has a real reproducible sandbox-product slice, not just UI copy:

```text
Instagram lead
→ normalized lead intake
→ MCP catalog / inventory / hours / policy / allergen / kitchen checks
→ order intent
→ Telegram owner approval request
→ owner approves
→ Square sandbox draft order
→ kitchen sandbox ticket
→ customer reply through channel adapter
→ evidence timeline
```

Customer message used by `npm run demo`:

> Can I order cake "Honey" for our office birthday today and pick it up after work?

Expected evidence events:

- `lead_received`
- `mcp_tool_called`
- `source_checked`
- `order_intent_created`
- `owner_approval_requested`
- `owner_approved`
- `pos_order_created`
- `kitchen_ticket_created`
- `customer_reply_sent`

## CLI checks

```bash
npm run assistant:test
npm run demo
npm run evaluator:smoke
npm run verify:sandbox
npm run verify
```

`npm run demo` writes:

- `evidence/<demo-run-id>.jsonl` — event stream
- `evidence/<demo-run-id>.json` — evaluator-friendly summary

## API checks

```bash
curl http://localhost:8787/health
curl http://localhost:8787/api/manifest
curl http://localhost:8787/api/mcp/smoke

curl -X POST http://localhost:8787/api/demo/vertical-slice \
  -H 'Content-Type: application/json' \
  -d '{"channel":"instagram","customerName":"Maya Chen","message":"Can I order cake \"Honey\" for our office birthday today and pick it up after work?"}'

curl -X POST http://localhost:8787/api/webhooks/instagram \
  -H 'Content-Type: application/json' \
  -d '{"name":"Maya Chen","handle":"@maya.office","message":"Can I order cake \"Honey\" for our office birthday today and pick it up after work?"}'
```

Then inspect the run:

```bash
curl http://localhost:8787/api/evidence/<demo-run-id>
```

## Live sandbox mode

Simulated mode is deterministic and safe for public clone. Real sandbox mode uses the same code path:

```bash
ASSISTANT_MODE=live MCP_MODE=live HAPPYCAKE_MCP_TEAM_TOKEN=[REDACTED] npm run dev
```

No real HappyCake credentials, real payments, or production WhatsApp/Instagram/Square access are required.
