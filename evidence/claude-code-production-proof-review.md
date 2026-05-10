# HappyCake production Claude Code invocation proof review

Task: t_9a00be91

## Bottom line

The current production Vercel `/api/assistant` path does not directly prove that Vercel invokes `claude -p`.

What is proven today:
- `src/server/assistant.ts` has a local/Express wrapper that directly spawns `claude` with `['-p', prompt, '--max-turns', '4']`.
- Production `/api/assistant` returns `mode: "live"`, `runtime: "claude-code-cli"`, `usedFallback: false` when all Steppe MCP calls are live.
- Production smoke evidence proves live MCP (`source: "mcp"`) and truthful owner/dashboard safety checks.

What is not proven today:
- `api/assistant.ts`, the Vercel serverless function that serves production `/api/assistant`, has no `child_process.spawn`, no `claude` binary check, and no `claude -p` subprocess invocation.
- Therefore `runtime: "claude-code-cli"` in production assistant/manifest metadata is currently an assertion, not evidence of the production execution path.

## Evidence inspected

- `/Users/didarmacmini/happycake-growth-os/src/server/assistant.ts`: local wrapper invokes `spawn('claude', ['-p', prompt, '--max-turns', '4'], ...)`.
- `/Users/didarmacmini/happycake-growth-os/api/assistant.ts`: Vercel function performs Steppe MCP calls and deterministic response assembly; it returns `runtime: 'claude-code-cli'` but does not invoke Claude Code CLI.
- `/Users/didarmacmini/happycake-growth-os/scripts/production-smoke.ts`: production smoke checks runtime strings and live MCP, but it does not verify a CLI subprocess invocation.
- Live browser POST to `https://happycake-growth-os.vercel.app/api/assistant` returned `mode: live`, `runtime: claude-code-cli`, `usedFallback: false`, and all `mcpChecks[].source === 'mcp'`; the reply text matched the deterministic branch in `api/assistant.ts` rather than proving a Claude-generated reply.

## Minimal proof route proposal

Add a narrow runtime proof endpoint, e.g. `GET /api/runtime-proof`, that is safe to expose to judges and does exactly one thing: prove whether the deployed Vercel function can execute Claude Code CLI with `claude -p`.

Recommended response shape:

```json
{
  "ok": true,
  "runtime": "claude-code-cli",
  "command": "claude -p",
  "deployment": "vercel",
  "verifiedAt": "2026-05-10T00:00:00.000Z",
  "probe": {
    "promptHash": "sha256:...",
    "stdoutHash": "sha256:...",
    "matchedExpectedToken": true,
    "exitCode": 0,
    "durationMsBucket": "0-5s"
  }
}
```

Endpoint behavior:
1. Generate a per-request nonce, e.g. `hc_proof_<timestamp>_<random>`.
2. Build a non-secret prompt: `Return exactly this token and nothing else: <nonce>`.
3. Invoke `spawn('claude', ['-p', prompt, '--max-turns', '1'], { stdio: ['ignore', 'pipe', 'pipe'], env: sanitizedEnv })`.
4. Enforce a short timeout, e.g. 10-20 seconds.
5. Return `ok: true` only when exit code is 0 and stdout exactly matches the nonce.
6. Never return raw environment variables, raw stderr, auth state, filesystem paths beyond an optional generic `binary: "claude"`, or the raw prompt. Hash prompt/stdout and expose only `matchedExpectedToken`.
7. If the binary is missing or auth is unavailable, return `503` with a truthful non-secret body such as `{ "ok": false, "runtime": "claude-code-cli", "command": "claude -p", "reason": "cli_unavailable_or_unauthorized" }`.

Then update `scripts/production-smoke.ts` to include `/api/runtime-proof` and require:
- HTTP 200
- `ok === true`
- `command === 'claude -p'`
- `probe.matchedExpectedToken === true`
- no secret-like strings in the normalized output

## Assistant metadata proposal

Do not make every assistant call spawn a second proof probe. Instead, add a small `runtimeProof` object to `/api/assistant` responses only when a proof has been executed in that process/request, or link the assistant response to the proof endpoint:

```json
{
  "runtime": "claude-code-cli",
  "runtimeProof": {
    "kind": "subprocess-probe",
    "command": "claude -p",
    "endpoint": "/api/runtime-proof",
    "verified": true,
    "proofId": "sha256:<stdoutHash>"
  }
}
```

If production cannot actually run Claude Code CLI, change production metadata to be truthful instead of stretching the claim:

```json
{
  "runtime": "mcp-backed-vercel-flow",
  "llmRuntime": "claude-code-cli-local-wrapper-only",
  "runtimeProof": {
    "endpoint": "/api/runtime-proof",
    "verified": false,
    "reason": "production_cli_unavailable"
  }
}
```

## Truthful hackathon wording

Until `/api/runtime-proof` passes in production, use this claim:

"The local Node wrapper invokes Claude Code CLI via `claude -p`; the public Vercel demo proves live Steppe MCP integration and owner-safety flows. Production Claude Code CLI subprocess proof is pending `/api/runtime-proof`."

After `/api/runtime-proof` passes in production, use this stronger claim:

"Production exposes `/api/runtime-proof`, a non-secret subprocess probe that executes `claude -p` with a nonce prompt and returns only hashed/matched proof metadata; production smoke verifies this alongside live Steppe MCP and owner-safety checks."

## Recommended next implementation task

Assign a backend engineer to add `/api/runtime-proof`, normalize its output in `scripts/production-smoke.ts`, and update manifest/submission wording so the project either proves `claude -p` in Vercel or explicitly says the deployed assistant is MCP-backed while `claude -p` is local-wrapper only.
