# Architecture

## Concept

**HappyCake Growth OS** is a sales operating system for a local bakery trying to grow from **$15–20k/month** to **$40k/month**.

Core thesis:

> HappyCake should own local cake-worthy moments in Sugar Land: birthdays, offices, schools, churches, family dinners, apologies, thank-yous, and same-day “on the way home” decisions.

## Runtime

Live path:

```text
Customer / owner event
→ Node wrapper
→ claude -p "task prompt"
→ MCP sandbox/source-of-truth checks
→ customer reply + owner Telegram summary
→ evidence log
```

Fallback path:

```text
Customer / owner event
→ Node wrapper
→ deterministic simulator
→ clearly marked simulated response
→ evidence log
```

The fallback exists only so the evaluator can run the repo without private credentials.

## Agents

### 1. Sales Concierge

Channels: website assistant, WhatsApp, Instagram DM.  
Job: convert interest into qualified order intent.

Collects:

- occasion;
- pickup date/time;
- product preference;
- headcount;
- contact;
- note/decoration request if allowed.

Never invents inventory, prices, allergens, hours, or delivery.

### 2. Local Demand Agent

Channels: Google Business, Instagram, site landing pages.  
Job: make $500/month perform like a focused local growth system.

Runs:

- same-day cake campaign;
- Friday office dessert drop;
- holiday/calendar campaigns;
- Google review engine;
- attribution report.

### 3. B2B Coordinator Agent

Targets:

- office managers;
- HR;
- school/PTA organizers;
- church coordinators;
- realtors;
- medical/dental offices.

Goal: recurring monthly orders.

### 4. Retention Agent

Loops:

- QR on box;
- birthday/occasion reminders;
- review request;
- referral note;
- “repeat last year’s cake?” prompts.

### 5. Owner Command Center

Owner-facing UI is Telegram.

Owner can:

- approve campaigns;
- approve posts/ads;
- review uncertain order requests;
- see daily sales digest;
- mark kitchen status;
- request edits.

## Data

- `public/data/products.json`: agent-readable catalog.
- `public/data/growth-model.json`: $40k revenue model and campaigns.
- `public/agent-manifest.json`: capabilities and runtime constraints.
- `evidence/*.jsonl`: generated audit trail.

## MCP tools expected

Configured endpoint:

```text
https://www.steppebusinessclub.com/api/mcp
```

Expected tool families:

- Square/POS: catalog, inventory, order creation, sales summary.
- Kitchen: production summary, ticket creation, accept/reject, ready status.
- WhatsApp/Instagram: inbound threads, replies, simulated publishing.
- Google Business: reviews, posts, local metrics.
- Marketing: create campaign, launch simulation, generate leads, owner report.
- Evaluator: evidence summary, scenario scoring, team report.

## Evidence schema

Every important action records:

- `event_id`
- `demo_run_id`
- `type`
- `channel`
- `summary`
- `entity_id`
- `data`
- timestamp

Evaluator should be able to trace:

```text
campaign → lead → assistant reply → order intent → owner approval → POS/kitchen handoff
```

## Boundaries

This repo does not use:

- Claude Agent SDK;
- LangGraph;
- CrewAI;
- n8n;
- other core LLM providers.

It does not include real credentials.
