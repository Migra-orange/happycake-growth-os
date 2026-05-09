import type { OrderIntent } from '../../shared/schema';

export type AutopilotAction =
  | 'send_customer_reply'
  | 'create_order'
  | 'create_kitchen_ticket'
  | 'launch_campaign'
  | 'apply_discount'
  | 'schedule_followup';

export type PolicyDecision = {
  decision: 'allow' | 'require_owner_approval' | 'ask_clarifying_question' | 'block';
  action: AutopilotAction;
  reasons: string[];
  ownerApprovalRequired: boolean;
};

export function evaluatePolicy(intent: OrderIntent, context: { action: AutopilotAction; discountUsd?: number; channelConfirmed?: boolean }): PolicyDecision {
  const reasons = new Set<string>();
  const missing = intent.requiredFieldsMissing || [];
  const risks = new Set(intent.riskFlags || []);

  if (missing.length) reasons.add('missing_required_fields');
  if (risks.has('allergy')) reasons.add('allergy_risk');
  if (risks.has('delivery')) reasons.add('delivery_not_confirmed');
  if (risks.has('same_day')) reasons.add('same_day_request');
  if (risks.has('complaint')) reasons.add('complaint_escalation');
  if (risks.has('custom_request')) reasons.add('custom_request');
  if ((context.discountUsd || 0) > 5) reasons.add('discount_limit_exceeded');

  const sideEffectActions: AutopilotAction[] = ['create_order', 'create_kitchen_ticket', 'launch_campaign', 'apply_discount'];

  if (risks.has('complaint') && context.action !== 'send_customer_reply') {
    return { decision: 'block', action: context.action, reasons: [...reasons, 'no_side_effects_for_complaints'], ownerApprovalRequired: true };
  }

  if (context.action === 'send_customer_reply') {
    if (missing.length || risks.has('allergy') || risks.has('delivery')) {
      return { decision: 'ask_clarifying_question', action: context.action, reasons: [...reasons], ownerApprovalRequired: false };
    }
    return { decision: 'allow', action: context.action, reasons: [...reasons], ownerApprovalRequired: false };
  }

  if (sideEffectActions.includes(context.action)) {
    return { decision: 'require_owner_approval', action: context.action, reasons: reasons.size ? [...reasons] : ['side_effect_requires_owner_approval'], ownerApprovalRequired: true };
  }

  return { decision: 'allow', action: context.action, reasons: [...reasons], ownerApprovalRequired: false };
}
