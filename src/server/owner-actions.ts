import { callMcp } from './mcp';

export type OwnerActionRequest = {
  action: 'approve_campaign' | 'reject_campaign' | 'daily_digest' | 'approve_post' | 'escalate_order' | 'approve_order_handoff';
  campaignId?: string;
  intentId?: string;
  approvalId?: string;
  note?: string;
};

export async function handleOwnerAction(req: OwnerActionRequest) {
  if (req.action === 'daily_digest') {
    return {
      reply: 'Today: focus on same-day classics, reply to DMs under 5 minutes, ask every happy pickup for a Google review.',
      mcp: await callMcp('marketing_report_to_owner', { scope: 'happycake_growth_os', reportType: 'daily_digest' })
    };
  }
  if (req.action === 'approve_campaign') {
    return {
      reply: `Campaign ${req.campaignId || 'draft'} approved. It can now be published/simulated.`,
      mcp: await callMcp('marketing_create_campaign', { campaignId: req.campaignId, approvedByOwner: true, note: req.note })
    };
  }
  if (req.action === 'approve_order_handoff') {
    return {
      reply: `Order handoff ${req.intentId || req.approvalId || 'draft'} approved in Telegram. Sandbox POS/kitchen actions may proceed.`,
      mcp: await callMcp('marketing_report_to_owner', { ...req, approvedByOwner: true, sideEffects: ['square_create_order', 'kitchen_create_ticket'] })
    };
  }
  if (req.action === 'approve_post') {
    return {
      reply: 'Post approved. Publish only after platform/source-of-truth check.',
      mcp: await callMcp('marketing_report_to_owner', { approvedByOwner: true, note: req.note, action: 'approve_post' })
    };
  }
  return { reply: 'Owner action recorded. Human review remains required before customer promise.', mcp: await callMcp('marketing_report_to_owner', req) };
}
