export function getTelegramBots() {
  return [
    { name: 'Owner Command Center', usernameEnv: 'TELEGRAM_BOT_USERNAME', tokenEnv: 'TELEGRAM_BOT_TOKEN', purpose: 'Approves campaigns/posts, reviews edge-case orders, receives daily sales digest.', status: 'live when env configured; simulated in demo' },
    { name: 'Sales Concierge Bot', usernameEnv: 'TELEGRAM_SALES_BOT_USERNAME', tokenEnv: 'TELEGRAM_SALES_BOT_TOKEN', purpose: 'Optional separate bot for WhatsApp/Instagram order-intent alerts.', status: 'planned split; single-bot owner mode supported' },
    { name: 'Marketing Agent Bot', usernameEnv: 'TELEGRAM_MARKETING_BOT_USERNAME', tokenEnv: 'TELEGRAM_MARKETING_BOT_TOKEN', purpose: 'Optional campaign approval queue and performance reporting.', status: 'planned split; single-bot owner mode supported' }
  ];
}
