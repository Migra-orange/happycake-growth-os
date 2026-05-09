export function getManifest() {
  return {
    name: 'HappyCake Growth OS',
    version: '0.1.0',
    pitch: 'AI agents turn Sugar Land moments into HappyCake orders, repeat customers, and measurable $40k/month growth.',
    runtime: { llm: 'claude-code-cli', command: 'claude -p', fallback: 'deterministic simulator' },
    endpoints: { health: '/health', assistant: '/api/assistant', evidence: '/api/evidence', manifest: '/api/manifest', products: '/data/products.json', growthModel: '/data/growth-model.json' },
    constraints: { noAgentSdk: true, noLangGraph: true, noCrewAI: true, noN8n: true, noOtherCoreLlmProvider: true },
    salesFunnels: ['same-day cakes', 'office/school/church recurring orders', 'Instagram/WhatsApp order intent', 'Google Business local discovery', 'packaging QR review/referral/reminder loop'],
    target: { currentMonthlyRevenueUsd: '15000-20000', targetMonthlyRevenueUsd: 40000 }
  };
}
