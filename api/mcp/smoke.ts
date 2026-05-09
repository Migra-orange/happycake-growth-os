import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    ok: true,
    source: process.env.HAPPYCAKE_MCP_TEAM_TOKEN ? 'steppe-mcp-configured' : 'simulated',
    tool: 'square_list_catalog',
    note: 'Public Vercel demo does not expose team tokens. Live MCP works when HAPPYCAKE_MCP_TEAM_TOKEN is configured server-side.'
  });
}
