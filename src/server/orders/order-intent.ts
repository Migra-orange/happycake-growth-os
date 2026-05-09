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
    return `Hi${intent.customerName ? ` ${intent.customerName}` : ''}. Thank you for reaching out to HappyCake. Pick one cake from the menu and send your pickup window — the owner will confirm final availability, allergens, and pickup before fulfillment.`;
  }
  return `Hi${intent.customerName ? ` ${intent.customerName}` : ''}. Your HappyCake request for ${intent.productPreference || 'a classic cake'} is queued. I matched it against the sandbox catalog and kitchen status; the owner still approves final pickup and handoff before fulfillment.`;
}
