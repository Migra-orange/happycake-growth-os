# HappyCake Growth OS

**Pitch:** AI agents turn Sugar Land moments into HappyCake orders, repeat customers, and measurable growth toward **$40k/month**.

This is not just a chatbot. It is a local demand engine:

- selling website / storefront;
- agent-readable product and growth data;
- WhatsApp / Instagram order-intent concierge;
- Telegram owner command center model;
- $500/month marketing engine;
- MCP/evidence-first demo flow.

## Business target

Current revenue: **$15–20k/month**.  
Target: **$40k/month**.

Revenue model:

- existing walk-ins and repeat base: **$18k**
- Google Maps / local search / same-day page: **$7k**
- WhatsApp + Instagram assisted orders: **$5k**
- office / school / church recurring orders: **$7k**
- reminder / referral / review loop: **$3k**

## Quickstart

```bash
npm install
cp .env.example .env
npm run dev
```

Open:

- website: `http://localhost:5173`
- API health: `http://localhost:8787/api/health`

## Demo commands

```bash
npm run assistant:test
npm run demo
npm run evaluator:smoke
npm run production:smoke
npm run verify:sandbox
npm run build
npm test
```

The local app uses **Claude Code CLI via `claude -p`** when available and can fail closed in `ASSISTANT_MODE=live`. The public Vercel deployment is a serverless judge demo that proves real Steppe MCP connectivity, owner approval safety, Vercel Blob durability, and browser UX; it does not claim that Vercel itself executes the local `claude -p` binary. If Claude or MCP credentials are missing locally, the app uses a clearly marked deterministic simulator so the evaluator can still run the vertical slice.

## Main demo flow

**Local Campaign → Instagram/WhatsApp Lead → MCP Source Checks → AI Sales → Owner Telegram Approval → POS/Kitchen Handoff → Evidence Log**

Example:

1. Campaign: Friday Office Dessert Drop.
2. Lead arrives from Instagram DM.
3. Sales Concierge normalizes the lead and creates order intent.
4. Agent checks source-of-truth through MCP before promising availability: catalog, inventory, hours, policies, allergens, kitchen.
5. Owner receives Telegram approval card.
6. Approval creates sandbox Square order and kitchen ticket.
7. Customer reply is sent through the channel adapter.
8. Evidence log records the whole path and `npm run evaluator:smoke` writes deterministic proof to `evidence/evaluator-smoke-latest.json` while asserting the required timeline.

## Hackathon compliance

- Claude Code CLI: yes, wrapper calls `claude -p`.
- Local execution: yes.
- Telegram owner UI: yes, documented and modeled; live if env token configured.
- MCP sandbox: config included for `https://www.steppebusinessclub.com/api/mcp`.
- No real credentials: yes.
- No Agent SDK / LangGraph / CrewAI / n8n: yes.
- Public repo safe: `.env` ignored, `.env.example` only.

## Agent-friendly URLs

- `/data/products.json`
- `/data/growth-model.json`
- `/agent-manifest.json`
- `/api/manifest`
- `/api/evidence`

## Deterministic evaluator proof

- `npm run evaluator:smoke` writes `evidence/evaluator-smoke-latest.json` with normalized timeline/source proof and omits volatile UUIDs, timestamps, customer PII, and credentials.
- `npm run production:smoke` writes `evidence/production-smoke-latest.json` with normalized live endpoint proof for `https://happycake-growth-os.vercel.app`.
- Judge proof map: see `SUBMISSION.md` for exact endpoint assertions covering Claude Code CLI, Steppe MCP `source:mcp`, owner approval safety, durable Vercel Blob state, encrypted private PII flows, buyer UX, and secret hygiene.

## Why this helps the real business

HappyCake does not need “more content.” It needs a system that creates and captures demand:

- be found when people search “cake near me”;
- answer fast when people DM;
- convert offices, schools, churches into recurring accounts;
- turn every cake box into reviews, referrals, and reminders;
- give the owner a daily Telegram sales plan.


## Submission docs

- `ARCHITECTURE.md` — runtime, agents, data, evidence schema.
- `GROWTH_PLAN.md` — real $40k/month business plan.
- `DEMO.md` — evaluator demo script and API commands.
- `SUBMISSION.md` — hackathon compliance notes.

## Live mode

Public demo defaults to deterministic `ASSISTANT_MODE=simulated`. For hackathon live runtime:

```bash
ASSISTANT_MODE=live HAPPYCAKE_MCP_TEAM_TOKEN=[REDACTED] npm run dev
```

The wrapper calls `claude -p`; no SDK/LangGraph/CrewAI/n8n is used.

## Security

Never commit:

- Telegram tokens;
- MCP team tokens;
- real WhatsApp/Instagram/Square credentials;
- real payment credentials.

Run:

```bash
npm run check:secrets
```
