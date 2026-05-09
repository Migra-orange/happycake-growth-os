import type { McpResult, OrderIntent } from '../../shared/schema';
import { callMcp } from '../mcp';

type HandoffOptions = { demoRunId: string; channel: string };

export async function runSourceChecks(intent: OrderIntent, options: HandoffOptions): Promise<McpResult[]> {
  const urgency = intent.riskFlags.includes('same_day') ? 'same_day' : 'standard';
  const checks = await Promise.all([
    callMcp('square_list_catalog', { intentId: intent.intentId, product: intent.productPreference }, { ...options, entityId: intent.intentId }),
    callMcp('square_check_inventory', { intentId: intent.intentId, product: intent.productPreference, sku: 'HC-HONEY-12' }, { ...options, entityId: intent.intentId }),
    callMcp('business_get_hours', { intentId: intent.intentId, pickupWindow: intent.pickupWindow }, { ...options, entityId: intent.intentId }),
    callMcp('business_get_policies', { intentId: intent.intentId, risks: intent.riskFlags }, { ...options, entityId: intent.intentId }),
    callMcp('business_get_allergens', { intentId: intent.intentId, product: intent.productPreference }, { ...options, entityId: intent.intentId }),
    callMcp('kitchen_get_production_summary', { intentId: intent.intentId, urgency }, { ...options, entityId: intent.intentId })
  ]);
  intent.state = 'source_checked';
  return checks;
}

export async function createSandboxHandoff(intent: OrderIntent, options: HandoffOptions) {
  const pos = await callMcp('square_create_order', {
    intentId: intent.intentId,
    customerName: intent.customerName,
    customerHandle: intent.customerHandle,
    product: intent.productPreference,
    pickupWindow: intent.pickupWindow,
    channel: intent.channel,
    payment: 'not_collected_in_sandbox'
  }, { ...options, entityId: intent.intentId });
  intent.state = 'sandbox_order_created';

  const kitchen = await callMcp('kitchen_create_ticket', {
    intentId: intent.intentId,
    product: intent.productPreference,
    occasion: intent.occasion,
    pickupWindow: intent.pickupWindow,
    notes: intent.notes
  }, { ...options, entityId: intent.intentId });
  intent.state = 'kitchen_ticket_created';

  return { pos, kitchen };
}
