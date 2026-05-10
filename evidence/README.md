# Evidence

This folder contains audit logs for evaluator review.

Regenerate:

```bash
npm run demo
npm run evaluator:smoke
npm run production:smoke
npm run assistant:test
```

Proof files:

- `demo-run-*.jsonl` — raw event streams.
- `demo-run-*.json` — evaluator-friendly summaries.
- `evaluator-smoke-latest.json` — deterministic normalized local evaluator proof.
- `production-smoke-latest.json` — deterministic normalized production endpoint proof.

Evidence files are safe to commit only when they contain no secrets. Live demo runs are ignored by `.gitignore` unless intentionally copied as samples.
