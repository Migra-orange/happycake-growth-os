import type { AssistantRequest, OrderIntent } from '../../shared/schema';

function pickProduct(message: string) {
  const text = message.toLowerCase();
  if (text.includes('napoleon')) return 'cake "Napoleon"';
  if (text.includes('milk')) return 'cake "Milk Maiden"';
  if (text.includes('pistachio')) return 'cake "Pistachio Roll"';
  if (text.includes('honey')) return 'cake "Honey"';
  return undefined;
}

export function createOrderIntent(req: AssistantRequest, intentId: string): OrderIntent {
  const text = req.message.toLowerCase();
  const riskFlags = [
    /today|tonight|after work|last minute|now/.test(text) ? 'same_day' : '',
    /allerg|nut|gluten|dairy|egg/.test(text) ? 'allergy' : '',
    /deliver/.test(text) ? 'delivery' : '',
    /custom|write|text|decorat/.test(text) ? 'custom_request' : '',
    /wrong|upset|refund|complaint|bad/.test(text) ? 'complaint' : ''
  ].filter(Boolean);
  const missing = [
    pickProduct(req.message) ? '' : 'product',
    /pick|today|tomorrow|after work|tonight|date|time/.test(text) ? '' : 'pickup_window',
    req.customerName || req.customerHandle ? '' : 'customer_contact'
  ].filter(Boolean);

  return {
    intentId,
    state: missing.length ? 'needs_clarification' : 'lead_received',
    channel: req.channel,
    customerName: req.customerName,
    customerHandle: req.customerHandle,
    productPreference: pickProduct(req.message),
    occasion: /office/.test(text) ? 'office birthday' : /birthday/.test(text) ? 'birthday' : undefined,
    pickupWindow: /after work/.test(text) ? 'after work today' : /today|tonight/.test(text) ? 'today' : undefined,
    headcount: /office|team|company/.test(text) ? 10 : undefined,
    notes: req.message,
    riskFlags,
    requiredFieldsMissing: missing
  };
}

export function customerReplyForIntent(intent: OrderIntent) {
  if (intent.requiredFieldsMissing.length) {
    return `Hi${intent.customerName ? ` ${intent.customerName}` : ''}. Thank you for reaching out to HappyCake. I can help with that — I need ${intent.requiredFieldsMissing.join(', ')} before we confirm anything. We will check today’s bake and ask the owner before promising price, pickup, or availability.`;
  }
  return `Hi${intent.customerName ? ` ${intent.customerName}` : ''}. HappyCake can help with ${intent.productPreference || 'a classic cake'} for ${intent.occasion || 'your occasion'}. I checked the sandbox catalog, policies, and kitchen status; the owner still needs to approve the same-day handoff before we promise pickup. Next step: we will confirm availability and send the pickup details here.`;
}
