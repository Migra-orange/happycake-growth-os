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

## Judge checklist / proof map

Live app: `https://happycake-growth-os.vercel.app/`  
Owner/judge cockpit: `https://happycake-growth-os.vercel.app/#owner`

Run:

```bash
npm run verify:sandbox
npm run production:smoke
```

What to verify:

| Requirement | Proof |
| --- | --- |
| Claude Code CLI runtime | `src/server/assistant.ts` shells to `claude -p`; no Claude Agent SDK, LangGraph, CrewAI, n8n, or alternate core LLM provider. Model selection is controlled by the installed Claude Code CLI profile (war-room OpenClaw also reports `claude-opus-4-7`). |
| Real Steppe MCP calls | `GET /api/mcp/audit` returns `mode: "live"`, `usedFallback: false`, and every check has `source: "mcp"`. `GET /api/mcp/smoke` also returns top-level `source: "mcp"`; sandbox catalog wording inside the Steppe response is provider data, not local fallback. |
| Owner approval safety | `POST /api/assistant` with `requireOwnerApproval: true` creates a pending approval and no POS/kitchen side effects. `POST /api/telegram/owner-action` without owner token returns `401 owner_auth_required`; token approval is the only path that creates sandbox Square/kitchen side effects. |
| Durable owner state | `GET /api/owner/config` returns `storageMode: "vercel_blob"`, `durableConfigured: true`, `ownerAuthEnabled: true`; `GET /api/owner/dashboard` shows queue/config from the same durable mode. |
| Private PII flows | Birthday reminders and discount claims are written server-side to private Vercel Blob with AES-GCM encrypted payloads; public API responses omit phone/email/birthday. |
| Buyer UX | `/` is English, cake-buyer-only, ready-made classic cakes first, and avoids internal Growth OS/POS/sandbox/owner-approval wording. |
| Owner dashboard | `#owner` shows the live sandbox connection, 7+ agents/funnel/evidence, approval queue, and owner-token gated actions for judges. |
| Secret hygiene | `npm run check:secrets` must pass; `.env` is ignored and docs/examples redact token values as `[REDACTED]`. |

`npm run evaluator:smoke` writes `evidence/evaluator-smoke-latest.json`; `npm run production:smoke` writes `evidence/production-smoke-latest.json`. Both proof files are normalized to avoid volatile run IDs/timestamps and secrets.

The local evaluator must produce this required event chain:

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
