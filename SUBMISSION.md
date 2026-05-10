# Submission Notes

## What to judge

This repo implements the vertical slice:

**Instagram/WhatsApp/website lead → MCP source checks → order intent → Telegram owner approval → sandbox POS/kitchen handoff → customer reply → evidence log**

It is designed for the actual HappyCake business goal: move from **$15–20k/month** toward **$40k/month**.

## Compliance

- Runtime contract: Node wrapper calls `claude -p` in live mode after MCP context is collected.
- Owner UI: Telegram approval cards and owner action handler; local endpoint remains for deterministic evaluator demo.
- MCP: adapter configured for `https://www.steppebusinessclub.com/api/mcp` with `X-Team-Token` via env only.
- Public repo safe: no secrets committed.
- Customer-facing language: English.
- Brand: HappyCake.
- Guardrails: no fake availability/prices/hours/allergens/delivery promises.

## Evaluator proof

Run:

```bash
npm run verify:sandbox
npm run production:smoke
```

`npm run evaluator:smoke` writes `evidence/evaluator-smoke-latest.json`; `npm run production:smoke` writes `evidence/production-smoke-latest.json`. Both proof files are normalized to avoid volatile run IDs/timestamps and secrets.

It must produce this required event chain:

- `lead_received`
- `mcp_tool_called`
- `source_checked`
- `order_intent_created`
- `owner_approval_requested`
- `owner_approved`
- `pos_order_created`
- `kitchen_ticket_created`
- `customer_reply_sent`

## Important env vars

See `.env.example`. Real values must not be committed.

- `ASSISTANT_MODE=live` to require Claude Code CLI.
- `ASSISTANT_MODE=simulated` for deterministic public demo.
- `MCP_MODE=live` to fail closed if real MCP calls fail.
- `HAPPYCAKE_MCP_TEAM_TOKEN=[REDACTED]` for real sandbox.
- `TELEGRAM_BOT_TOKEN=[REDACTED]` for live Telegram.
