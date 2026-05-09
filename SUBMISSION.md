# Submission Notes

## What to judge

This repo implements the vertical slice:

**Local Campaign → Instagram/WhatsApp Lead → AI Sales → POS/Kitchen Handoff → Owner Telegram → Evidence Log**

It is designed for the actual HappyCake business goal: move from **$15–20k/month** toward **$40k/month**.

## Compliance

- Runtime contract: Node wrapper calls `claude -p` in live mode.
- Owner UI: Telegram endpoints and bot metadata; no owner web dashboard required.
- MCP: adapter configured for `https://www.steppebusinessclub.com/api/mcp` with `X-Team-Token` via env only.
- Public repo safe: no secrets committed.
- Customer-facing language: English.
- Brand: HappyCake.
- Guardrails: no fake availability/prices/hours/allergens/delivery promises.

## Important env vars

See `.env.example`. Real values must not be committed.

- `ASSISTANT_MODE=live` to require Claude Code CLI.
- `ASSISTANT_MODE=simulated` for deterministic public demo.
- `HAPPYCAKE_MCP_TEAM_TOKEN=[REDACTED]` for real sandbox.
- `TELEGRAM_BOT_TOKEN=[REDACTED]` for live Telegram.
