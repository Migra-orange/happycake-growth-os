# HappyCake Sandbox Product Implementation Plan

## Goal

Turn the current demo into a real sandbox-integrated vertical slice while preserving the project constraints:

- Runtime LLM: Claude Code CLI only via `claude -p`.
- Model target: Opus 4.7 where available through Claude Code CLI configuration.
- Owner UI: Telegram only.
- No Agent SDK, LangGraph, CrewAI, n8n, or alternate core LLM runtime.
- No real business credentials committed or required for public demo.
- Customer-facing copy: English only.
- Source-of-truth requirement: never fabricate prices, inventory, hours, allergens, delivery, or policies.

## Strong vertical slice

```text
Instagram / WhatsApp / website lead
→ intake API
→ Claude Code CLI orchestrator
→ MCP catalog / inventory / policy / kitchen checks
→ order-intent draft and risk classification
→ Telegram owner approval card
→ approved sandbox POS + kitchen handoff
→ evidence log
→ customer response through source channel adapter
```

## Target architecture

### 1. Inbound channel layer

Files to add or expand:

- `src/server/channels/website.ts`
- `src/server/channels/instagram.ts`
- `src/server/channels/whatsapp.ts`
- `src/server/channels/types.ts`
- `api/webhooks/instagram.ts`
- `api/webhooks/whatsapp.ts`

Responsibilities:

- Normalize all inbound leads into one `LeadMessage` schema.
- Support sandbox/dry-run events without real platform credentials.
- Store raw inbound payload hash in evidence, not secrets or unnecessary PII.
- Website assistant can be live immediately; Instagram/WhatsApp adapters default to sandbox simulation unless tokens are supplied.

### 2. Claude Code CLI orchestration layer

Files to expand:

- `src/server/assistant.ts`
- `src/server/prompts/sales-concierge.ts`
- `src/server/prompts/order-intent.ts`
- `src/server/prompts/owner-card.ts`

Responsibilities:

- Build deterministic prompts for `claude -p`.
- Include MCP check results in the prompt, not as hallucinated context.
- Require structured JSON output validated by Zod.
- Keep deterministic simulator only for public/no-token mode.
- Fail closed in live mode if Claude CLI is unavailable or returns invalid JSON.

Expected output contract:

- `customerDraft`: safe response text.
- `ownerSummary`: short owner-facing summary.
- `orderIntent`: occasion, pickup window, product preference, quantity/headcount, contact, source.
- `requiredApprovals`: owner, kitchen, policy, inventory.
- `mcpChecks`: exact tool calls and results.
- `riskFlags`: same-day, allergy, custom request, complaint, delivery, unclear price.

### 3. MCP sandbox adapter layer

Files to add or expand:

- `src/server/mcp.ts`
- `src/server/mcp/tools.ts`
- `src/server/mcp/client.ts`
- `src/server/mcp/fixtures.ts`

Tool families to model explicitly:

- Catalog/inventory:
  - `square_list_catalog`
  - `square_check_inventory`
- Policies:
  - `business_get_hours`
  - `business_get_policies`
  - `business_get_allergens`
- Kitchen:
  - `kitchen_get_production_summary`
  - `kitchen_create_ticket`
  - `kitchen_accept_ticket`
  - `kitchen_mark_ready`
- Order/POS:
  - `square_create_order`
  - `square_update_order_status`
- Messaging:
  - `instagram_send_reply`
  - `whatsapp_send_reply`
  - `website_send_reply`
- Owner/evaluator:
  - `owner_action_log`
  - `evaluator_record_event`
  - `evaluator_get_summary`

Responsibilities:

- One typed `callMcpTool(name, input)` interface.
- Real sandbox mode uses `HAPPYCAKE_MCP_URL` and `HAPPYCAKE_MCP_TEAM_TOKEN`.
- Simulated mode returns fixtures clearly marked as `source: simulated`.
- Evidence records every MCP call, result status, latency, and redacted input.

### 4. Order-intent and handoff domain layer

Files to add:

- `src/server/orders/order-intent.ts`
- `src/server/orders/handoff.ts`
- `src/server/orders/policies.ts`

Responsibilities:

- Convert lead conversation into `OrderIntent`.
- Enforce required fields before handoff.
- Prevent order creation until catalog, inventory, policy, and kitchen checks pass or owner explicitly approves uncertainty.
- Create sandbox POS order and kitchen ticket only after owner approval for demo slice.

Order states:

```text
lead_received
→ needs_clarification
→ source_checked
→ owner_approval_pending
→ owner_approved
→ sandbox_order_created
→ kitchen_ticket_created
→ customer_reply_sent
→ closed
```

### 5. Telegram owner command center

Files to add or expand:

- `src/server/telegram.ts`
- `src/server/telegram/bot.ts`
- `src/server/telegram/cards.ts`
- `src/server/telegram/callbacks.ts`
- `api/telegram/webhook.ts`
- `api/telegram/owner-action.ts`

Owner UI must support:

- Lead/order approval card with inline buttons:
  - Approve order handoff
  - Ask customer a clarification
  - Reject / unavailable
  - Escalate to owner manual handling
- Daily digest command.
- Campaign approval command.
- Kitchen status command.

Telegram approval card must include:

- Channel and source.
- Customer ask.
- MCP evidence summary.
- What the assistant plans to say.
- Exact side effects if approved.

### 6. Evidence and observability layer

Files to expand:

- `src/server/evidence.ts`
- `src/shared/schema.ts`
- `scripts/demo.ts`
- `scripts/evaluator-smoke.ts`

Responsibilities:

- Use one `demo_run_id` across the whole vertical slice.
- Log JSONL event stream plus summary JSON.
- Include redaction and secret-safety checks.
- Provide `/api/evidence/:runId` and `/api/evidence/latest`.
- Add evaluator-friendly timeline:
  - campaign_created
  - lead_received
  - mcp_tool_called
  - source_checked
  - order_intent_created
  - owner_approval_requested
  - owner_approved
  - pos_order_created
  - kitchen_ticket_created
  - customer_reply_sent

## Work breakdown and agent assignments

### Agent A — Runtime/orchestration engineer

Tasks:

1. Refactor `runAssistant` into a strict orchestrator:
   - gather MCP context first;
   - call `claude -p` with a structured-output prompt;
   - validate output with Zod;
   - fallback only in simulated mode.
2. Add prompt modules and JSON schemas.
3. Add timeout, stderr, and invalid-JSON evidence events.

Tests:

- Unit: prompt contains no secrets and includes guardrails.
- Unit: invalid Claude output fails in live mode.
- Integration: `ASSISTANT_MODE=simulated npm run assistant:test` still passes.
- Contract: response validates against `AssistantResponseSchema`.

Evidence:

- `mcp_context_loaded`
- `claude_cli_invoked`
- `claude_cli_completed`
- `assistant_output_validated`

### Agent B — MCP integration engineer

Tasks:

1. Add typed MCP tool registry.
2. Implement real/simulated MCP client modes.
3. Add fixtures for catalog, inventory, policies, kitchen, order, messaging, evaluator.
4. Ensure tool failures create safe owner escalation, not fabricated customer promises.

Tests:

- Unit: each required tool has fixture output.
- Unit: missing token returns simulated source unless `MCP_MODE=live`.
- Integration: `/api/mcp/smoke` checks catalog + kitchen + policies.
- Failure: failed inventory check blocks order handoff.

Evidence:

- one event per MCP call with tool name, source, status, latency, redacted input, summarized output.

### Agent C — Telegram owner UI engineer

Tasks:

1. Implement live Telegram webhook handler.
2. Generate owner approval cards.
3. Handle inline callback actions.
4. Connect approval to POS/kitchen handoff.
5. Keep `/api/telegram/owner-action` for local scripted demo.

Tests:

- Unit: card renderer includes required MCP/evidence summary.
- Unit: callback auth rejects non-owner chat IDs.
- Integration: approve order via local endpoint creates owner evidence event.
- E2E simulated: owner approval advances order state.

Evidence:

- `owner_approval_requested`
- `owner_callback_received`
- `owner_approved` or `owner_rejected`

### Agent D — Channel and customer response engineer

Tasks:

1. Add normalized channel schemas.
2. Implement website assistant path first.
3. Add Instagram/WhatsApp sandbox webhook adapters.
4. Implement outbound dry-run replies through MCP messaging tools.

Tests:

- Unit: each channel payload normalizes to `LeadMessage`.
- Integration: Instagram lead triggers assistant + owner card.
- Integration: WhatsApp lead triggers same flow.
- Safety: no response is sent when owner approval is required and missing.

Evidence:

- `lead_received`
- `customer_reply_drafted`
- `customer_reply_sent` or `customer_reply_blocked`

### Agent E — Order/kitchen domain engineer

Tasks:

1. Add order-intent state machine.
2. Require source-of-truth checks before order creation.
3. Implement sandbox POS order creation.
4. Implement sandbox kitchen ticket creation.
5. Add policy/allergen/delivery escalation rules.

Tests:

- Unit: incomplete order intent asks clarification.
- Unit: allergy/delivery/custom/price uncertainty escalates.
- Integration: approved same-day office lead creates POS + kitchen sandbox handoff.
- Failure: kitchen capacity risk blocks auto-promise.

Evidence:

- `order_intent_created`
- `source_checked`
- `pos_order_created`
- `kitchen_ticket_created`

### Agent F — QA/evidence/evaluator engineer

Tasks:

1. Expand demo script to run the complete vertical slice.
2. Add evidence timeline assertions.
3. Add secret scanner checks for Telegram/MCP tokens.
4. Add CI-friendly `npm run verify:sandbox`.
5. Produce sample evidence under `evidence/` from simulated mode only.

Tests:

- E2E: demo produces required event sequence.
- E2E: no secrets in generated evidence.
- E2E: evaluator smoke returns pass/fail plus missing-events list.
- Regression: `npm run verify` remains green.

Evidence:

- `evaluator_summary`
- `scenario_score`
- final JSON summary file for demo submission.

## Phased delivery plan

### Phase 0 — Baseline hardening, 0.5 day

- Run current tests and document gaps.
- Clean `.env.example` duplicate `TELEGRAM_OWNER_CHAT_ID`.
- Add `IMPLEMENTATION_PLAN.md` to repo.
- Confirm no forbidden frameworks are present.

Acceptance:

- `npm test` passes.
- `npm run check:secrets` passes.

### Phase 1 — Typed contracts and evidence, 1 day

- Add schemas for `LeadMessage`, `OrderIntent`, `McpToolCall`, `OwnerApproval`, and `EvidenceEvent` versions.
- Add evidence redaction and timeline helpers.
- Add tests for schema validation and required event sequence.

Acceptance:

- E2E simulated run writes a single run-level JSONL timeline.
- Evidence can prove lead → source checks → owner approval request.

### Phase 2 — MCP source-of-truth layer, 1 day

- Add typed MCP client + fixtures.
- Replace ad-hoc tool names with registry.
- Add policy/allergen/hours checks.

Acceptance:

- `/api/mcp/smoke` covers catalog, kitchen, policies, and evaluator.
- Tool failures produce safe escalation.

### Phase 3 — Order intent and handoff, 1 day

- Implement state machine and handoff service.
- Wire owner approval into POS/kitchen sandbox calls.
- Add blocked states for missing fields or risk flags.

Acceptance:

- Same-day office lead can become a pending owner approval.
- Owner approval creates sandbox POS order and kitchen ticket.

### Phase 4 — Telegram owner UI, 1 day

- Add Telegram webhook and callback parser.
- Render approval cards.
- Restrict actions to `TELEGRAM_OWNER_CHAT_ID`.
- Keep local endpoint for no-token demo.

Acceptance:

- Simulated owner action and live Telegram callback share the same domain handler.
- Evidence shows exact owner action and resulting side effects.

### Phase 5 — Channel adapters and customer response, 1 day

- Add website, Instagram sandbox, WhatsApp sandbox adapters.
- Route outbound replies through MCP/dry-run channel tools.
- Ensure approval gates are respected.

Acceptance:

- Website/Instagram/WhatsApp leads all enter same flow.
- Customer reply is sent only after required checks/approval.

### Phase 6 — Final vertical-slice demo, 0.5 day

- Expand `scripts/demo.ts` to run full path.
- Add `npm run verify:sandbox`.
- Update `DEMO.md`, `ARCHITECTURE.md`, `SUBMISSION.md`.

Acceptance:

- One command creates a full evidence file for:
  `Instagram lead → MCP checks → owner approve → POS/kitchen handoff → customer response`.

## Required test matrix

- `npm test`: unit and contract tests.
- `npm run lint`: TypeScript strict checks.
- `npm run assistant:test`: assistant guardrail flow.
- `npm run demo`: simulated evidence generation.
- `npm run evaluator:smoke`: evidence completeness check.
- `npm run check:secrets`: no committed credentials.
- `npm run verify:sandbox`: full vertical-slice regression once added.

## Definition of done

The product is sandbox-integrated when:

1. Live mode uses `claude -p`; no SDK or alternate LLM runtime exists.
2. The assistant cannot promise price, inventory, hours, allergens, delivery, or policy without MCP/source-of-truth evidence or owner approval.
3. Telegram is the only owner UI for approvals and commands.
4. The strong vertical slice works in simulated public mode and MCP sandbox mode.
5. Evidence logs prove every important action and side effect.
6. Secret scanning and tests pass without real credentials.
