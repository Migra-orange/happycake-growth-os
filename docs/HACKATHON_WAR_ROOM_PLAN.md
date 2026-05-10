# HappyCake Hackathon War Room Plan

Updated: 2026-05-10 00:05 CDT

## Mission
Win the hackathon by making HappyCake Growth OS complete, demonstrable, safe, and judge-verifiable without relying on unverified UI labels.

Production: https://happycake-growth-os.vercel.app  
Owner dashboard: https://happycake-growth-os.vercel.app/#owner  
Repo: https://github.com/Migra-orange/happycake-growth-os

## Non-negotiable proof gates

1. **Real MCP proof**
   - `/api/mcp/smoke` returns `source: mcp`.
   - `/api/mcp/audit` returns `usedFallback:false` and `failures: []`.
   - `/api/assistant` production order lead returns `usedFallback:false` and all `mcpChecks[].source === "mcp"`.

2. **Owner approval semantics**
   - `/api/telegram/owner-action` without owner token returns `401 owner_auth_required`.
   - POS/kitchen side effects only happen after explicit owner approval.
   - Approved synthetic QA flow executes:
     - `marketing_report_to_owner`
     - `square_create_order`
     - `kitchen_create_ticket`

3. **Buyer/owner separation**
   - Public buyer UI is English-only and cake-shopper-facing.
   - Buyer UI must not expose internal wording: Growth OS, POS, sandbox proof, owner approval/review, internal agent mechanics.
   - Owner dashboard may show agents, funnel, approvals, evidence, and MCP checks.

4. **Durability + privacy**
   - Owner config/approval queue uses Vercel Blob durable storage.
   - Birthday reminders and discount claims are private + encrypted and do not return phone/email.
   - `npm run check:secrets` passes.

5. **Judge/evaluator readiness**
   - Deterministic local checks: `npm test`, `npm run build`, `npm run verify`.
   - Deterministic production smoke/evaluator should emit JSON proof with URLs, commit, MCP status, owner approval status, and browser QA result.
   - README/DEMO/SUBMISSION should explain how judges reproduce the proof.

## Autonomous run loop, every 30 minutes until 8 AM

Each cron run must:

1. Inspect repo state and docs.
2. Spawn parallel auditors:
   - Product/judging auditor.
   - Technical/security auditor.
   - Browser/e2e evaluator.
3. Check external agents/bots:
   - Mac mini OpenClaw status + reviewer smoke when available.
   - iMac via `work@10.0.0.64` OpenClaw/Hermes diagnostics without printing secrets.
   - Kanban board/assignees if reliable.
4. Run local verification:
   - `npm test`
   - `npm run build`
   - `npm run verify`
5. Run production verification:
   - `/api/health`
   - `/api/mcp/smoke`
   - `/api/mcp/audit`
   - `/api/owner/dashboard`
   - `/api/owner/config`
   - synthetic `/api/assistant` order lead
   - no-token owner action 401
   - token-approved synthetic QA handoff only
   - browser QA public + owner
6. Fix any critical/important gap.
7. Commit, push, deploy production, and re-run proof if changes were made.
8. Send concise Russian report to Telegram.

## Workstream backlog

### A. Submission/docs
- Ensure README/DEMO/SUBMISSION have judge-friendly flow:
  - buyer flow
  - owner dashboard flow
  - MCP proof routes
  - approval semantics
  - commands to run
  - expected outputs
- Add screenshots/evidence if useful.

### B. Evaluators
- Maintain a production smoke script that validates all proof gates and writes JSON evidence.
- Maintain public-copy guardrail tests.
- Maintain secret scan and PII endpoint tests.

### C. Product polish
- Buyer homepage: premium cake store, clean navigation, working order request, wheel, chat, social/reviews/map.
- Owner dashboard: immediately understandable to judges, live MCP checks above the fold, approval queue visible.

### D. Safety/security
- No secret leakage.
- No real/customer side effects without owner approval.
- Only synthetic QA approvals can be auto-approved during cron verification.

### E. Agent orchestration
- Hermes cron is the main durable orchestrator.
- delegate_task subagents perform parallel audits per run.
- OpenClaw on Mac mini and iMac are used as reviewers if healthy; failures are logged as blockers and do not stop core verification.
- Kanban is used if profiles/board are healthy; otherwise delegate_task is used.

## Definition of done by morning

- Production works from a clean browser.
- Owner dashboard clearly proves live sandbox/MCP connection.
- Full website → MCP → owner approval → POS/kitchen handoff synthetic funnel passes.
- Local test/build/verify pass.
- Public repo has no secrets and has clear judge instructions.
- Evidence artifacts exist and are fresh.
- Remaining risks are documented with exact blockers and next action.
