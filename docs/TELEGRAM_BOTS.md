# Telegram Bots

Owner-facing UI is Telegram only.

## Owner Command Center

- Purpose: approve campaigns, approve posts/ads, review edge-case orders, receive daily digest.
- Token env var: `TELEGRAM_BOT_TOKEN`
- Chat env var: `TELEGRAM_OWNER_CHAT_ID`
- Status: live when env configured; simulated in demo.

## Sales Concierge Bot

- Purpose: optional split bot for WhatsApp/Instagram order-intent alerts.
- Token env var: `TELEGRAM_SALES_BOT_TOKEN`
- Status: planned split; current repo supports single owner bot.

## Marketing Agent Bot

- Purpose: optional campaign approval queue and performance reporting.
- Token env var: `TELEGRAM_MARKETING_BOT_TOKEN`
- Status: planned split; current repo supports single owner bot.

No tokens are committed.
