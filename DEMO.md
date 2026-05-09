# Demo Script

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

## Scenario: Friday Office Dessert Drop

1. Owner opens Telegram command center.
2. Marketing agent drafts **Friday Office Dessert Drop**.
3. Owner approves via Telegram.
4. Instagram lead arrives: “Can I order something for our office birthday today and pick it up after work?”
5. Sales Concierge replies warmly, asks headcount + pickup time, and does not promise inventory.
6. Agent records required MCP checks:
   - `square_list_catalog`
   - `kitchen_get_production_summary`
   - `square_create_order`
   - `kitchen_create_ticket`
7. Owner receives lead card.
8. Evidence log proves the path.

## CLI checks

```bash
npm run assistant:test
npm run demo
npm run evaluator:smoke
npm run verify
```

## API checks

```bash
curl http://localhost:8787/health
curl http://localhost:8787/api/manifest
curl http://localhost:8787/api/mcp/smoke
curl -X POST http://localhost:8787/api/assistant   -H 'Content-Type: application/json'   -d '{"channel":"instagram","message":"Can I order something for our office birthday today and pick it up after work?"}'
```
