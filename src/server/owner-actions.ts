import { callMcp } from './mcp';

export type OwnerActionRequest = {
  action: 'approve_campaign' | 'reject_campaign' | 'daily_digest' | 'approve_post' | 'escalate_order';
  campaignId?: string;
  note?: string;
};

export async function handleOwnerAction(req: OwnerActionRequest) {
  if (req.action === 'daily_digest') {
    return {
      reply: 'Today: focus on On the Way Home Cakes, reply to DMs under 5 minutes, ask every happy pickup for a Google review.',
      mcp: await callMcp('marketing_daily_report', { scope: 'happycake_growth_os' })
    };
  }
  if (req.action === 'approve_campaign') {
    return {
      reply: `Campaign ${req.campaignId || 'draft'} approved. It can now be published/simulated.`,
      mcp: await callMcp('marketing_create_campaign', { campaignId: req.campaignId, approvedByOwner: true, note: req.note })
    };
  }
  if (req.action === 'approve_post') {
    return {
      reply: 'Post approved. Publish only after platform/source-of-truth check.',
      mcp: await callMcp('google_business_create_post', { approvedByOwner: true, note: req.note })
    };
  }
  return { reply: 'Owner action recorded. Human review remains required before customer promise.', mcp: await callMcp('owner_action_log', req) };
}
