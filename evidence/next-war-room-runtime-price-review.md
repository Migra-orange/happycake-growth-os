# HappyCake next war-room review: runtime proof + price-source evidence

Task: t_cc6258fd
Date: 2026-05-10
Scope: readiness after the 08:03 evidence run, focused only on judge risk around production `claude -p` proof and buyer price source-of-truth.

## Bottom line

Two judge-facing claims still need tightening before final presentation:

1. Production currently proves live Steppe MCP + owner-safety paths, but not a Vercel `claude -p` subprocess. The production `/api/assistant` function is deterministic MCP-backed code that returns `runtime: "claude-code-cli"`; the actual `spawn('claude', ['-p', ...])` path exists in the local Express wrapper only.
2. Buyer prices are visible and consistent in the local/demo catalog, but the public catalog states they come from HappyCake's published cake menu without embedding source evidence. Either attach a source/evidence trail per price or soften the wording to demo/menu-request pricing pending bakery confirmation.

## Evidence inspected

- `src/server/assistant.ts:29-52` directly spawns `claude -p` in local/live Express mode.
- `api/assistant.ts:173-267` is the production Vercel assistant path; it performs MCP calls, builds deterministic replies, and returns `runtime: 'claude-code-cli'` at `api/assistant.ts:222-225` without invoking `child_process.spawn` or `claude`.
- `SUBMISSION.md:13` and `SUBMISSION.md:37` claim the runtime contract/proof as `claude -p`.
- `public/agent-manifest.json:5-14` and live `/agent-manifest.json` claim `llm: "claude-code-cli"`, `command: "claude -p"`, and list `/api/assistant` as production proof.
- `evidence/production-smoke-latest.json` proves live MCP, Vercel deployment, owner config, and products endpoint; it does not include a CLI subprocess proof endpoint.
- `evidence/evaluator-smoke-latest.json` and the 08:03 demo run are deterministic/simulated local proof, not production `claude -p` proof.
- `public/data/products.json:5-58` exposes four product prices and claims prices/product names come from HappyCake's published cake menu; no URL, screenshot, MCP response ID, scrape hash, owner approval note, or checked-at evidence is attached.
- 08:03 demo evidence includes simulated catalog prices for Honey/Napoleon/Milk Maiden/Pistachio Roll, matching local demo data rather than an externally verifiable HappyCake menu source.

## Finding 1 — runtime proof wording is currently too strong

Risk: judges can inspect `api/assistant.ts` and see that production `/api/assistant` is deterministic MCP flow, not a Claude Code CLI subprocess. Current docs/manifest make `/api/assistant` part of the proof set for `claude -p`, which overstates what production proves.

Recommended exact correction until a production runtime probe exists:

- In `SUBMISSION.md:13`, replace:
  `Runtime contract: Node wrapper calls claude -p in live mode after MCP context is collected.`
  with:
  `Runtime contract: the local Node/Express wrapper calls claude -p in live mode after MCP context is collected; the public Vercel demo currently proves live Steppe MCP integration and owner-safety flows, while production Claude Code CLI subprocess proof is pending /api/runtime-proof.`

- In `SUBMISSION.md:37`, replace the proof cell with:
  `Local Claude Code CLI wrapper: src/server/assistant.ts shells to claude -p. Production Vercel assistant: api/assistant.ts is an MCP-backed deterministic serverless flow until /api/runtime-proof proves a deployed Claude Code CLI subprocess. No Claude Agent SDK, LangGraph, CrewAI, n8n, or alternate core LLM provider is used.`

- In `public/agent-manifest.json`, change `runtime.production.proof` so `/api/assistant` is not represented as `claude -p` proof. Safer shape:
  `"production": { "mcp": "live Steppe MCP", "usedFallback": false, "proof": ["/api/mcp/smoke", "/api/mcp/audit"], "claudeCodeCliProof": "pending /api/runtime-proof" }`

Stronger fix if time permits: add `/api/runtime-proof` that runs a nonce prompt through `claude -p`, returns only non-secret hashes/match status, and add it to `scripts/production-smoke.ts`. Do not expose raw stderr, env, auth state, filesystem paths, prompt, or model credentials.

## Finding 2 — buyer price source evidence is incomplete

Risk: the buyer UI shows prices (`$42`, `$46`, `$39`, `$44`) and the products JSON says they come from HappyCake's published cake menu, but the repo does not include verifiable source fields. A judge could ask whether these are real, sandbox, owner-approved, or invented.

Recommended exact correction if no stronger source is available immediately:

- In `public/data/products.json:5-8`, replace:
  `Prices and product names come from HappyCake's published cake menu.`
  with:
  `Displayed prices are demo menu values for the hackathon flow; the bakery confirms final price, availability, allergens, pickup, delivery, and special requests before fulfillment.`

- In the shopper hero/copy where prices are shown (`src/web/App.tsx:433-451`), keep prices visible but add a small qualifier near the catalog header or order fineprint:
  `Demo menu prices shown for order-request flow; final bakery confirmation required before checkout.`

- In JSON-LD (`src/web/App.tsx:201-204`), either remove `makesOffer.price` until source proof exists, or add source-backed fields before publishing it as structured offer data. Structured data with unverified prices is higher risk than visible UI copy.

Preferred stronger fix: add `source` metadata per product, for example `priceSource: { kind: "owner_approved_menu" | "mcp_square_catalog" | "public_menu", checkedAt, evidenceFile, urlOrTool }`, then make production smoke verify every `priceUsd` has a non-empty source trail. If using Steppe Square catalog as source, save a redacted normalized catalog proof file and point products at that evidence.

## Go/no-go recommendation

Go for demo if the presenter verbally frames production as "live MCP + owner-safety proof, with local Claude Code CLI wrapper shown in code." Do not claim production `/api/assistant` itself proves `claude -p` until `/api/runtime-proof` passes. For prices, either attach source evidence today or soften all claims from "published cake menu" to "demo menu values/final bakery confirmation required." 
