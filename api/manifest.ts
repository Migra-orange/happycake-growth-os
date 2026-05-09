import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    name: 'HappyCake Growth OS',
    runtime: 'claude-code-cli',
    ownerUi: 'telegram',
    publicDemo: true,
    links: {
      growthModel: '/data/growth-model.json',
      products: '/data/products.json',
      assistant: '/api/assistant',
      mcpSmoke: '/api/mcp/smoke'
    }
  });
}
