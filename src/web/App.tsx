import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { AssistantResponse } from '../shared/schema';

type Product = { id:string; name:string; shortName:string; priceUsd:number; weight:string; serves:string; availabilityPolicy:string; tags:string[]; image:string; description:string };
type BusinessProfile = { brand:string; locality:string; instagram:{ handle:string; url:string; label:string; posts:{ title:string; url:string; note:string }[] }; googleMaps:{ label:string; searchUrl:string; status:string; address:string; phone:string; website:string; plusCode:string; ownerPost?:string }; reviews:{ source:string; status:string; summary:string; rating:number; countLabel:string; items:{ label:string; text:string; rating:number; url:string }[] }; agentReadable:{ llmsTxt:string; manifest:string; catalog:string; assistant:string } };
type ChatMessage = { role:'visitor' | 'assistant'; text:string };
type GrowthModel = { campaigns:{id:string;name:string;budgetUsd:number;channels:string[];promise:string;kpi:string}[] };
type Channel = 'website' | 'instagram' | 'whatsapp';
type Offer = { label:string; value:string; code:string; angle:'discount' | 'none'; discountPercent?:number };
type Dashboard = { ok:boolean; mode:string; updatedAt:string; storageMode?:string; metrics:Record<string, number>; funnel:{label:string;value:number}[]; channels:{label:string;orders:number;revenueUsd:number}[]; topProducts:{name:string;orders:number;revenueUsd:number}[]; mcpChecks:{ok:boolean;source:string;tool:string;latencyMs:number}[]; agents:AgentConfig[]; autopilotTimeline?:AutopilotEvent[]; approvalQueue?:ApprovalQueueItem[] };
type AgentConfig = { id:string; name:string; enabled:boolean; mode:string; tone:string; dailyLimit:number; goal:string };
type AutopilotEvent = { type:string; label:string; summary:string; status:string };
type ApprovalQueueItem = { approvalId:string; intentId:string; customer:string; status:string; riskFlags:string[]; policyDecision:string; summary:string; proposedSideEffects:string[]; expiresIn:string; decisionAt?:string; decisionSource?:string; executedSideEffects?:string[] };
type AgentConfigResponse = { ok:boolean; agents:AgentConfig[]; version:number; updatedAt:string; storageMode:string; durableConfigured:boolean; ownerAuthEnabled:boolean };

const API = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:8787' : '');

const offers: Offer[] = [
  { label: '5% off', value: 'Take 5% off your cake request', code: 'CAKE5', angle: 'discount', discountPercent: 5 },
  { label: '10% off', value: 'Take 10% off your cake request', code: 'CAKE10', angle: 'discount', discountPercent: 10 },
  { label: '20% off', value: 'Take 20% off your cake request', code: 'CAKE20', angle: 'discount', discountPercent: 20 },
  { label: '50% off', value: 'Take 50% off your cake request', code: 'CAKE50', angle: 'discount', discountPercent: 50 },
  { label: 'Nothing', value: 'No discount this spin — you can still send your cake request', code: 'NO-DISCOUNT', angle: 'none' }
];

const occasionTiles = [
  { title: 'Birthday table', detail: 'Honey and Milk Maiden are gentle crowd-pleasers for family celebrations.', tag: 'Birthdays', icon: '🎂' },
  { title: 'Office share', detail: 'Napoleon cuts clean, travels well, and feels special without a custom build.', tag: 'Work treats', icon: '🍰' },
  { title: 'Gift moment', detail: 'Pistachio Roll brings brighter flavor when you want the cake to feel like a present.', tag: 'Gifts', icon: '🎁' }
];

const landingHighlights = [
  'Shop by real cake menu',
  'Pickup reviewed before confirmation',
  'Instagram, map, and AI helper ready'
];

const fallbackBusinessProfile: BusinessProfile = {
  brand: 'HappyCake',
  locality: 'Sugar Land, Texas',
  instagram: { handle: '@happycake.us', url: 'https://www.instagram.com/happycake.us/', label: 'Instagram', posts: [
    { title: 'Latest reel', url: 'https://www.instagram.com/happycake.us/reel/DWVzB3_GOJ_/', note: 'Open on Instagram' },
    { title: 'Cake reel', url: 'https://www.instagram.com/reel/DXNImvmki_N/', note: 'Open on Instagram' },
    { title: 'Bakery reel', url: 'https://www.instagram.com/reel/DXGdcJNjqxs/', note: 'Open on Instagram' }
  ] },
  googleMaps: { label: 'Happy Cake on Google Maps', searchUrl: 'https://www.google.com/maps/search/Happy+Cake+Sugar+Land+TX', status: 'google_maps_limited_view_verified', address: '350 Promenade Wy #500, Sugar Land, TX 77478', phone: '(281) 979-8320', website: 'happycake.us', plusCode: 'J952+JW Sugar Land, Texas', ownerPost: 'Every celebration deserves a cake made just for them.' },
  reviews: { source: 'Google Maps limited view', status: 'rating_visible_review_text_limited', summary: 'Google Maps shows Happy Cake as a 4.7-star cake shop. Open Maps for the latest public review text.', rating: 4.7, countLabel: 'Google rating', items: [
    { label: 'Latest Google review', rating: 4.7, text: 'Open the newest public review on Google Maps.', url: 'https://www.google.com/maps/search/Happy+Cake+Sugar+Land+TX' },
    { label: 'Recent Google review', rating: 4.7, text: 'See the latest customer notes directly on Maps.', url: 'https://www.google.com/maps/search/Happy+Cake+Sugar+Land+TX' },
    { label: 'More Google reviews', rating: 4.7, text: 'Read more public Google reviews for Happy Cake.', url: 'https://www.google.com/maps/search/Happy+Cake+Sugar+Land+TX' }
  ] },
  agentReadable: { llmsTxt: '/llms.txt', manifest: '/agent-manifest.json', catalog: '/data/products.json', assistant: '/api/assistant' }
};

const ownerWorkstreams = [
  { label: 'Cold lead mining', owner: 'Local demand scout', action: 'Finds local moments the owner can attack today.' },
  { label: 'Content + ads', owner: 'Content + ad agent', action: 'Drafts posts, Google updates, and micro-campaigns for approval.' },
  { label: 'Website conversion', owner: 'Site conversion agent', action: 'Turns cake shoppers into structured order requests.' },
  { label: 'Customer support', owner: 'Customer support agent', action: 'Tracks pickup/support/review loops after the order.' }
];

const actionLabels: Record<string, string> = {
  lead_received: 'Order started',
  mcp_tool_called: 'Menu checked',
  source_checked: 'Catalog and kitchen checked',
  order_intent_created: 'Order intent created',
  owner_approval_requested: 'Bakery review queued',
  owner_approved: 'Bakery confirmed',
  pos_order_created: 'Order handoff ready',
  kitchen_ticket_created: 'Cake prep queued',
  customer_reply_sent: 'Reply prepared'
};

function cleanShopperText(text = '') {
  return text
    .replace(/sandbox catalog/gi, 'cake menu')
    .replace(/sandbox/gi, 'menu')
    .replace(/POS summary/gi, 'order summary')
    .replace(/POS/gi, 'order system')
    .replace(/owner/gi, 'bakery')
    .replace(/MCP/gi, 'system');
}

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [growth, setGrowth] = useState<GrowthModel | null>(null);
  const [view, setView] = useState<'shop' | 'owner'>(() => (typeof window !== 'undefined' && (window.location.hash === '#owner' || window.location.search.includes('owner=1')) ? 'owner' : 'shop'));
  const [channel, setChannel] = useState<Channel>('website');
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Product | null>(null);
  const [pickup, setPickup] = useState('Today after work');
  const [headcount, setHeadcount] = useState('10');
  const [note, setNote] = useState('');
  const [offer, setOffer] = useState<Offer | null>(null);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [promoName, setPromoName] = useState('');
  const [promoPhone, setPromoPhone] = useState('');
  const [promoEmail, setPromoEmail] = useState('');
  const [promoClaim, setPromoClaim] = useState<{ promoCode:string; discountPercent:number } | null>(null);
  const [promoStatus, setPromoStatus] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [result, setResult] = useState<AssistantResponse | null>(null);
  const [ownerResult, setOwnerResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTrail, setShowTrail] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [agentDrafts, setAgentDrafts] = useState<AgentConfig[]>([]);
  const [configSaved, setConfigSaved] = useState(false);
  const [configStatus, setConfigStatus] = useState('loading server config');
  const [ownerToken, setOwnerToken] = useState('');
  const [birthdayName, setBirthdayName] = useState('');
  const [birthdayPhone, setBirthdayPhone] = useState('');
  const [birthdayDate, setBirthdayDate] = useState('');
  const [birthdayConsent, setBirthdayConsent] = useState(true);
  const [birthdayStatus, setBirthdayStatus] = useState('');
  const [birthdayLoading, setBirthdayLoading] = useState(false);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(fallbackBusinessProfile);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([{ role: 'assistant', text: 'Hi — ask me about cakes, serving size, pickup request details, or which cake fits your occasion.' }]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    fetch('/data/products.json').then(r => r.json()).then(d => setProducts(d.products));
    fetch('/data/business-profile.json').then(r => r.json()).then(setBusinessProfile).catch(() => {});
    fetch('/data/growth-model.json').then(r => r.json()).then(setGrowth).catch(() => {});
    refreshDashboard();
    setOwnerToken(localStorage.getItem('happycake-owner-token') || '');
  }, []);

  function ownerHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (ownerToken.trim()) headers['x-owner-token'] = ownerToken.trim();
    return headers;
  }

  function updateOwnerToken(value: string) {
    setOwnerToken(value);
    if (value.trim()) localStorage.setItem('happycake-owner-token', value.trim());
    else localStorage.removeItem('happycake-owner-token');
  }

  async function refreshDashboard() {
    try {
      const d:Dashboard = await fetch(`${API}/api/owner/dashboard`).then(r => r.json());
      setDashboard(d);
      try {
        const cfg:AgentConfigResponse = await fetch(`${API}/api/owner/config`).then(r => r.json());
        if (cfg.ok) {
          setAgentDrafts(cfg.agents);
          setConfigStatus(`${cfg.storageMode}${cfg.durableConfigured ? ' · durable' : ' · demo memory'}${cfg.ownerAuthEnabled ? ' · owner auth on' : ' · owner auth off'}`);
          return;
        }
      } catch {}
      const saved = localStorage.getItem('happycake-agent-config');
      const agents = saved ? JSON.parse(saved) : d.agents;
      setAgentDrafts(agents);
      setConfigStatus('local draft fallback');
    } catch {}
  }

  const featured = products[1] || products[0];

  const jsonLd = useMemo(() => ({
    '@context': 'https://schema.org', '@type': 'Bakery', name: 'HappyCake', address: { '@type': 'PostalAddress', addressLocality: 'Sugar Land', addressRegion: 'TX' },
    url: 'https://happycake.us', servesCuisine: 'cakes and desserts', makesOffer: products.map(p => ({ '@type': 'Offer', price: p.priceUsd, priceCurrency: 'USD', itemOffered: { '@type': 'Product', name: p.name, description: p.description, image: p.image } }))
  }), [products]);

  function spinOffer() {
    if (spinning) return;
    const nextIndex = Math.floor(Math.random() * offers.length);
    const next = offers[nextIndex];
    const slice = 360 / offers.length;
    const targetCenter = nextIndex * slice + slice / 2;
    setOffer(null);
    setPromoClaim(null);
    setPromoStatus('');
    if (name && !promoName) setPromoName(name);
    setSpinning(true);
    setWheelRotation(previous => {
      const normalized = ((previous % 360) + 360) % 360;
      return previous + 360 * 5 + (360 - targetCenter) - normalized;
    });
    window.setTimeout(() => {
      setOffer(next);
      setSpinning(false);
      localStorage.setItem('happycake-offer-seen', '1');
    }, 1650);
  }

  function startOrder(product: Product) {
    setSelected(product);
    setNote(`I would like ${product.name}${promoClaim ? ` with code ${promoClaim.promoCode}` : ''}.`);
    document.getElementById('order')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function submitOrder() {
    const product = selected || featured;
    if (!product) return;
    const request = `Order request: ${product.name}, ${product.weight}, $${product.priceUsd}. Pickup: ${pickup}. Headcount: ${headcount}. ${promoClaim ? `Offer code: ${promoClaim.promoCode} — ${promoClaim.discountPercent}% off. ` : ''}${note}`;
    setLoading(true);
    setOwnerResult('');
    const res = await fetch(`${API}/api/assistant`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel, customerName: name || undefined, message: request, source: 'happycake-shop-catalog', requireOwnerApproval: true, productId: product.id, offerCode: promoClaim?.promoCode }) });
    const data = await res.json();
    setResult(data);
    if (data?.requiredApprovals?.[0]) {
      const approval = data.requiredApprovals[0];
      setDashboard(current => current ? {
        ...current,
        approvalQueue: [
          {
            approvalId: approval.approvalId,
            intentId: approval.intentId,
            customer: data.orderIntent?.customerName || 'Website customer',
            status: approval.status,
            riskFlags: data.riskFlags || [],
            policyDecision: 'require_owner_approval',
            summary: approval.summary,
            proposedSideEffects: approval.sideEffectsIfApproved || [],
            expiresIn: '3h'
          },
          ...(current.approvalQueue || []).filter(item => item.approvalId !== approval.approvalId)
        ],
        metrics: { ...current.metrics, pendingApprovals: (current.metrics.pendingApprovals || 0) + 1 }
      } : current);
    }
    setShowTrail(false);
    setLoading(false);
  }

  async function submitChatMessage() {
    const message = chatInput.trim();
    if (!message || chatLoading) return;
    setChatInput('');
    setChatMessages(list => [...list, { role: 'visitor', text: message }]);
    setChatLoading(true);
    try {
      const res = await fetch(`${API}/api/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: 'website', customerName: name || 'Website visitor', message, source: 'happycake-onsite-chat', requireOwnerApproval: true })
      });
      const data: AssistantResponse = await res.json();
      setChatMessages(list => [...list, { role: 'assistant', text: cleanShopperText(data.reply || 'Thanks — send an order request when you are ready and the bakery will confirm details.') }]);
      setResult(data);
    } catch {
      setChatMessages(list => [...list, { role: 'assistant', text: 'I can help with menu questions and order notes. Please try again in a moment.' }]);
    }
    setChatLoading(false);
  }

  async function ownerApprove(action: 'approve_order_handoff' | 'reject_campaign', queueItem?: ApprovalQueueItem) {
    const approvalId = queueItem?.approvalId || result?.requiredApprovals?.[0]?.approvalId;
    const intentId = queueItem?.intentId || result?.orderIntent?.intentId;
    const note = queueItem?.summary || result?.ownerSummary || 'Owner reviewed order.';
    const res = await fetch(`${API}/api/telegram/owner-action`, { method: 'POST', headers: ownerHeaders(), body: JSON.stringify({ action, intentId, approvalId, campaignId: 'shop-offer', note }) });
    const data = await res.json();
    if (res.status === 401) {
      setOwnerResult('Owner token required before approval/reject actions.');
      return;
    }
    setOwnerResult(data.reply || JSON.stringify(data));
    if (data?.approval && approvalId) {
      setDashboard(current => current ? {
        ...current,
        approvalQueue: (current.approvalQueue || []).map(item => item.approvalId === approvalId ? { ...item, status: data.approval.status, decisionAt: data.approval.decisionAt, decisionSource: data.approval.decisionSource, executedSideEffects: data.approval.executedSideEffects || [] } : item)
      } : current);
    }
  }

  async function claimDiscountCode() {
    if (!offer || offer.angle !== 'discount') return;
    setPromoLoading(true);
    setPromoStatus('');
    try {
      const res = await fetch(`${API}/api/discount-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: promoName, phone: promoPhone, email: promoEmail, discountPercent: offer.discountPercent, sourceCode: offer.code, source: 'spin-wheel' })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'discount_claim_failed');
      setPromoClaim({ promoCode: data.claim.promoCode, discountPercent: data.claim.discountPercent });
      setPromoStatus(`Sent — use ${data.claim.promoCode} at checkout.`);
      if (!name && promoName) setName(promoName);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'discount_claim_failed';
      setPromoStatus(message === 'name_required' ? 'Add your name first.' : message === 'contact_required' ? 'Add a phone number or email.' : 'Add a valid phone number or email.');
    }
    setPromoLoading(false);
  }

  async function submitBirthdayReminder() {
    setBirthdayLoading(true);
    setBirthdayStatus('');
    try {
      const res = await fetch(`${API}/api/birthday-reminder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: birthdayName || name, phone: birthdayPhone, birthday: birthdayDate, consent: birthdayConsent, source: 'homepage-birthday-card' })
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data?.error || 'birthday_save_failed');
      setBirthdayStatus(`Saved — we’ll text your birthday cake reminder with ${data.lead.discountCode}.`);
      setBirthdayPhone('');
      setBirthdayDate('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'birthday_save_failed';
      setBirthdayStatus(message === 'sms_consent_required' ? 'Please allow birthday reminder texts first.' : 'Add a valid phone number and birthday date.');
    }
    setBirthdayLoading(false);
  }

  function updateAgent(id: string, patch: Partial<AgentConfig>) {
    setConfigSaved(false);
    setAgentDrafts(list => list.map(a => a.id === id ? { ...a, ...patch } : a));
  }

  async function saveAgentConfig() {
    try {
      const res = await fetch(`${API}/api/owner/config`, { method: 'POST', headers: ownerHeaders(), body: JSON.stringify({ agents: agentDrafts }) });
      const data:AgentConfigResponse = await res.json();
      if (res.status === 401) {
        setConfigStatus('owner token required');
        return;
      }
      if (!res.ok || !data.ok) throw new Error('config_save_failed');
      setAgentDrafts(data.agents);
      setConfigStatus(`${data.storageMode}${data.durableConfigured ? ' · durable' : ' · demo memory'}${data.ownerAuthEnabled ? ' · owner auth on' : ' · owner auth off'}`);
      localStorage.removeItem('happycake-agent-config');
    } catch {
      localStorage.setItem('happycake-agent-config', JSON.stringify(agentDrafts));
      setConfigStatus('local draft fallback');
    }
    setConfigSaved(true);
    window.setTimeout(() => setConfigSaved(false), 2200);
  }

  const metric = (key: string, fallback = 0) => dashboard?.metrics?.[key] ?? fallback;

  return <main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

    {wheelOpen && <div className="offerOverlay" role="dialog" aria-modal="true">
      <div className="offerModal">
        <button className="closeOffer" onClick={() => { setWheelOpen(false); localStorage.setItem('happycake-offer-seen', '1'); }} aria-label="Close offer">×</button>
        <p className="eyebrow">Before you choose</p>
        <h2>Spin for today’s cake discount.</h2>
        <p className="offerLead">Win 5%, 10%, 20%, 50% off — or land on nothing. One quick spin before you request your cake.</p>
        <div className="wheelWrap">
          <div className="wheelPointer" aria-hidden="true" />
          <button
            className={`wheel ${spinning ? 'spinning' : ''}`}
            onClick={spinOffer}
            aria-label="Spin discount wheel"
            style={{ '--wheel-rotation': `${wheelRotation}deg` } as CSSProperties}
          >
            {offers.map((o, i) => <span key={o.code} style={{ transform: `rotate(${i * (360 / offers.length)}deg)` }}>{o.label}</span>)}
            <b>{spinning ? 'Spinning…' : offer ? offer.label : 'SPIN'}</b>
          </button>
        </div>
        {offer && offer.angle === 'none' && <div className="wonOffer emptyOffer"><small>Result</small><strong>Nothing</strong><p>{offer.value}. You can still choose a cake now.</p><button className="primary" onClick={() => setWheelOpen(false)}>Shop cakes</button></div>}
        {offer && offer.angle === 'discount' && <div className="wonOffer claimOffer"><small>You won</small><strong>{offer.label}</strong><p>Where should we send it? Add your name and phone or email to receive your individual checkout code.</p>
          {!promoClaim ? <div className="claimForm">
            <label>Name <input value={promoName} onChange={e => setPromoName(e.target.value)} placeholder="Your name" /></label>
            <label>Phone <input value={promoPhone} onChange={e => setPromoPhone(e.target.value)} placeholder="(832) 555-0101" inputMode="tel" /></label>
            <label>Email <input value={promoEmail} onChange={e => setPromoEmail(e.target.value)} placeholder="you@example.com" inputMode="email" /></label>
            <button className="primary wide" onClick={claimDiscountCode} disabled={promoLoading || !promoName.trim() || (!promoPhone.trim() && !promoEmail.trim())}>{promoLoading ? 'Sending code…' : 'Send my code'}</button>
          </div> : <div className="promoCodeBox"><small>Your individual code</small><strong>{promoClaim.promoCode}</strong><p>Use it at checkout to get {promoClaim.discountPercent}% off.</p><button className="primary" onClick={() => setWheelOpen(false)}>Shop cakes</button></div>}
          {promoStatus && <p className="birthdayStatus">{promoStatus}</p>}
        </div>}
      </div>
    </div>}

    <nav className="topbar">
      <button className="brandMark" onClick={() => setView('shop')} aria-label="HappyCake shop">
        <img src="/assets/logo/happy-cake-logo-256.png" alt="" />
        <span><b>HappyCake</b><small>Sugar Land cake shop</small></span>
      </button>
      <div className="navActions">
        <a className="ghost socialLink" href={businessProfile.instagram.url} target="_blank" rel="noreferrer">Instagram</a>
        <a className="ghost socialLink" href={businessProfile.googleMaps.searchUrl} target="_blank" rel="noreferrer">Map</a>
        <button className={view === 'shop' ? 'active' : 'ghost'} onClick={() => { setView('shop'); history.replaceState(null, '', '/'); }}>Shop cakes</button>
        <button className={view === 'owner' ? 'active' : 'ghost'} onClick={() => { setView('owner'); history.replaceState(null, '', '#owner'); }}>Owner</button>
      </div>
    </nav>

    {view === 'shop' && <>
      <section className="shopHero">
        <div className="heroText">
          <p className="eyebrow">Sugar Land cake shop</p>
          <h1>Celebration cakes without the back-and-forth.</h1>
          <p className="lead">Choose a real HappyCake menu item, see the price before you ask, then send one clean pickup request for the bakery to confirm.</p>
          <div className="heroActions"><a className="primary" href="#catalog">Shop the menu</a><button className="secondary" onClick={() => setWheelOpen(true)}>Spin for a discount</button></div>
          <div className="heroHighlights">{landingHighlights.map(item => <span key={item}>{item}</span>)}</div>
          {promoClaim && <div className="offerRibbon"><span>{promoClaim.promoCode}</span>{promoClaim.discountPercent}% off saved for checkout</div>}
        </div>
        <div className="heroShowcase">
          <img className="showcaseMain" src="/assets/hero/happy-cake-hero-02.webp" alt="HappyCake celebration cakes" />
          {featured && <div className="heroProductCard"><img src={featured.image} alt={featured.name}/><div><small>Featured cake</small><b>{featured.shortName || featured.name}</b><span>${featured.priceUsd} · {featured.weight} · {featured.serves}</span></div></div>}
        </div>
      </section>

      <section className="catalogSection catalogAfterHero" id="catalog">
        <div className="sectionHeader"><div><p className="eyebrow">Menu</p><h2>Shop the cake case.</h2></div><p>Best-seller style cards with price, size, serving guide, and one-tap order request.</p></div>
        <div className="categoryBar" aria-label="Cake shopping categories"><span>Best sellers</span><span>Birthday</span><span>Office</span><span>Gift</span><button onClick={() => setWheelOpen(true)}>5–50% discount wheel</button></div>
        <div className="catalogGrid">{products.map((p, i) => <article className={`cakeCard cakeCard${i}`} key={p.id}>
          <button className="photoButton" onClick={() => startOrder(p)}><img src={p.image} alt={p.name}/><span>{i === 0 ? 'Most loved' : p.tags[0]}</span></button>
          <div className="cakeInfo"><div><small>{p.tags.slice(0, 2).join(' · ')}</small><h3>{p.shortName || p.name}</h3><p>{p.description}</p></div><div className="cakeMeta"><b>${p.priceUsd}</b><span>{p.weight} · {p.serves}</span></div><button className="orderButton" onClick={() => startOrder(p)}>Order this cake</button></div>
        </article>)}</div>
      </section>

      <section className="landingSection occasionSection">
        <div className="sectionHeader"><div><p className="eyebrow">Occasions</p><h2>Pick by moment, not just flavor.</h2></div><p>Borrowed from the best cake storefronts: shoppers need fast paths for birthdays, gifts, and office tables.</p></div>
        <div className="occasionGrid">{occasionTiles.map(tile => <article key={tile.title}><i className="occasionIcon" aria-hidden="true">{tile.icon}</i><span>{tile.tag}</span><b>{tile.title}</b><p>{tile.detail}</p></article>)}</div>
      </section>

      <section className="landingSection connectSection" id="connect">
        <div className="connectCard socialCard instagramCard">
          <p className="eyebrow">Instagram</p>
          <h2>Latest posts from {businessProfile.instagram.handle}.</h2>
          <div className="postGrid">
            {(businessProfile.instagram.posts || []).map((post, i) => <a className="instaPost" href={post.url} target="_blank" rel="noreferrer" key={post.url}><span>0{i + 1}</span><b>{post.title}</b><small>{post.note}</small></a>)}
          </div>
        </div>
        <div className="connectCard reviewCard visualCard">
          <p className="eyebrow">Google ratings</p>
          <div className="ratingHero"><strong>{businessProfile.reviews.rating || 4.7}</strong><span>★★★★★</span><em>{businessProfile.reviews.countLabel}</em></div>
          <div className="reviewOrbit">{businessProfile.reviews.items.slice(0, 3).map(item => <a href={item.url || businessProfile.googleMaps.searchUrl} target="_blank" rel="noreferrer" key={item.label}><b>{item.label}</b><p>{item.text}</p><small>Open review</small></a>)}</div>
        </div>
        <div className="connectCard chatCard visualCard">
          <div className="sectionHeader compact"><div><p className="eyebrow">Onsite helper</p><h2>Ask HappyCake AI.</h2></div></div>
          <div className="miniChat phoneMock">
            <div className="chatMessages">{chatMessages.map((message, i) => <p className={message.role} key={`${message.role}-${i}`}><span>{message.text}</span></p>)}</div>
            <div className="chatInput"><input value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submitChatMessage(); }} placeholder="Ask which cake fits 12 people…" /><button onClick={submitChatMessage} disabled={chatLoading || !chatInput.trim()}>{chatLoading ? 'Asking…' : 'Send'}</button></div>
          </div>
        </div>
        <div className="connectCard detailsCard visualCard">
          <p className="eyebrow">Quick details</p>
          <h2>Everything useful, no clutter.</h2>
          <ul>
            <li><a href={businessProfile.googleMaps.searchUrl} target="_blank" rel="noreferrer">{businessProfile.googleMaps.address}</a></li>
            <li><a href="tel:+12819798320">{businessProfile.googleMaps.phone || '(281) 979-8320'}</a></li>
            <li><a href={`https://${businessProfile.googleMaps.website}`} target="_blank" rel="noreferrer">{businessProfile.googleMaps.website}</a></li>
          </ul>
        </div>
      </section>

      {selected && <section className="orderStage" id="order">
        <div className="orderSummary">
          <p className="eyebrow">Order request</p>
          <h2>{selected ? selected.name : 'Choose a cake to start.'}</h2>
          {selected ? <><img src={selected.image} alt={selected.name}/><div className="priceLine"><b>${selected.priceUsd}</b><span>{selected.weight} · {selected.serves}</span></div></> : <p>Select any cake above. We’ll prepare your request and ask the bakery to confirm details before anything is finalized.</p>}
          {promoClaim && <div className="offerApplied"><b>{promoClaim.promoCode}</b><span>{promoClaim.discountPercent}% off saved for checkout</span></div>}
        </div>
        <div className="orderForm">
          <label>Your name <input value={name} onChange={e=>setName(e.target.value)} placeholder="Optional" /></label>
          <label>Reply channel <select value={channel} onChange={e=>setChannel(e.target.value as Channel)}><option value="website">Website</option><option value="instagram">Instagram DM</option><option value="whatsapp">WhatsApp</option></select></label>
          <label>Pickup window <input value={pickup} onChange={e=>setPickup(e.target.value)} /></label>
          <label>Guests <input value={headcount} onChange={e=>setHeadcount(e.target.value)} /></label>
          <label>Note <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Add text on box, occasion, or question." /></label>
          <button className="primary wide" onClick={submitOrder} disabled={loading || !selected}>{loading ? 'Sending order request…' : 'Send order request'}</button>
          <p className="fineprint">Allergens, exact pickup time, and final availability are confirmed by the bakery before fulfillment.</p>
        </div>
      </section>}

      {result && <section className="replyPanel premiumResult">
        <div className="replyDraft"><span className="softBadge">Order request sent</span><h2>Customer reply</h2><p>{cleanShopperText(result.reply)}</p></div>
        <div className="realityBox"><div className="sectionHeader"><h2>What happens next</h2><button className="linkButton" onClick={() => setShowTrail(!showTrail)}>{showTrail ? 'Hide' : 'Show'}</button></div><div className="checkGrid"><span>Menu</span><span>Price</span><span>Pickup</span><span>Confirm</span></div>{showTrail && <ol className="trustTimeline">{result.actions.map((a,i)=><li key={i}><i /> <span><b>{actionLabels[a.type] || 'Checked'}</b><small>{cleanShopperText(a.detail)}</small></span></li>)}</ol>}</div>
      </section>}

    </>}

    {view === 'owner' && <>
      <section className="ownerHero dashboardHero">
        <div>
          <p className="eyebrow">Owner agent command center</p>
          <h1>Control every agent in the funnel.</h1>
          <p className="lead">The owner sees acquisition, content/ad work, website conversion, approvals, customer support, and retention in one cockpit — agents can suggest or draft, but risky actions wait for approval.</p>
        </div>
        <div className="modelCard liveCard">
          <small>{dashboard?.mode === 'live' ? 'Live sandbox connected' : 'Dashboard loading'}</small>
          <b>{dashboard ? `${dashboard.mcpChecks.filter(c => c.ok).length}/${dashboard.mcpChecks.length} checks green` : 'Checking MCP'}</b>
          <span>{dashboard?.updatedAt ? `Updated ${new Date(dashboard.updatedAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })} · ${dashboard.storageMode || 'live api'}` : 'Reading owner stats and agent defaults.'}</span>
        </div>
      </section>

      <section className="ownerWorkMap">
        {ownerWorkstreams.map(work => <article key={work.label}><span>{work.label}</span><b>{work.owner}</b><p>{work.action}</p><button onClick={() => document.getElementById('agent-config')?.scrollIntoView({ behavior: 'smooth' })}>Configure</button></article>)}
      </section>

      <section className="ownerDashboard">
        <div className="kpiGrid">
          <article><span>Cold leads</span><b>{dashboard?.funnel?.[0]?.value || 0}</b><small>Local demand pool</small></article>
          <article><span>Order requests</span><b>{metric('orderRequests')}</b><small>{metric('pendingApprovals')} waiting approval</small></article>
          <article><span>Conversion</span><b>{metric('conversionRate')}%</b><small>Visitor → request</small></article>
          <article><span>Support loops</span><b>{dashboard?.funnel?.[5]?.value || 0}</b><small>Reviews / reminders / support</small></article>
        </div>

        <div className="dashboardGrid">
          <section className="panel funnelPanel">
            <div className="sectionHeader compact"><div><p className="eyebrow">Full funnel</p><h2>Where each agent works.</h2></div></div>
            <div className="funnelBars">{dashboard?.funnel?.map((f, i) => {
              const max = dashboard.funnel[0]?.value || 1;
              return <div className="funnelRow" key={f.label}><div><b>{f.label}</b><span>{f.value}</span></div><i style={{ width: `${Math.max(8, (f.value / max) * 100)}%` }} /><em>{i === 0 ? 'traffic' : i === 1 ? 'hook' : i === 2 ? 'intent' : i === 3 ? 'order' : 'money'}</em></div>
            }) || <p className="muted">Loading funnel…</p>}</div>
          </section>

          <section className="panel approvalInbox">
            <div className="sectionHeader compact"><div><p className="eyebrow">Owner queue</p><h2>Approvals.</h2></div><span className="softBadge">Policy gated</span></div>
            <div className="queueList">
              {dashboard?.approvalQueue?.map(item => <article className="queueItem" key={item.approvalId}>
                <div><b>{item.customer}</b><span>{item.status} · {item.expiresIn}</span></div>
                <p>{item.summary}</p>
                <small>{item.policyDecision} · risks: {item.riskFlags.join(', ') || 'none'}</small>
                <em>{item.proposedSideEffects.join(' → ')}</em>
                {item.executedSideEffects?.length ? <small>Executed: {item.executedSideEffects.join(' → ')}</small> : null}
                {item.status === 'pending' && <div className="queueActions"><button onClick={() => ownerApprove('approve_order_handoff', item)}>Approve</button><button className="danger" onClick={() => ownerApprove('reject_campaign', item)}>Reject</button></div>}
              </article>)}
            </div>
            {result ? <div className="approvalCard"><b>{result.orderIntent?.customerName || 'Customer'} · {result.orderIntent?.channel}</b><p>{result.ownerSummary}</p><div className="approvalMeta"><span>Missing: {result.orderIntent?.requiredFieldsMissing?.join(', ') || 'none'}</span><span>Risks: {result.riskFlags?.join(', ') || 'none'}</span></div><div className="approvalButtons"><button onClick={() => ownerApprove('approve_order_handoff')}>Approve handoff</button><button className="secondary" onClick={() => setShowTrail(true)}>Open proof</button><button className="danger" onClick={() => ownerApprove('reject_campaign')}>Reject</button></div></div> : <div className="emptyState"><b>Autopilot queue is live.</b><p>Send an order from the shop to create a fresh owner approval card here.</p><button onClick={() => setView('shop')}>Open shop</button></div>}
            {ownerResult && <p className="ownerToast">{ownerResult}</p>}
          </section>

          <section className="panel productPanel">
            <div className="sectionHeader compact"><div><p className="eyebrow">Products</p><h2>What sells.</h2></div></div>
            <div className="rankList">{dashboard?.topProducts?.map((p, i) => <div key={p.name}><span>{i + 1}</span><b>{p.name}</b><em>{p.orders} orders · ${p.revenueUsd}</em></div>)}</div>
          </section>

          <section className="panel channelPanel">
            <div className="sectionHeader compact"><div><p className="eyebrow">Channels</p><h2>Demand sources.</h2></div></div>
            <div className="channelGrid">{dashboard?.channels?.map(c => <article key={c.label}><b>{c.label}</b><span>{c.orders} orders</span><strong>${c.revenueUsd}</strong></article>)}</div>
          </section>
        </div>
      </section>

      <section className="autopilotPanel">
        <div className="sectionHeader">
          <div><p className="eyebrow">Autopilot engine</p><h2>Demand → conversion → support, with approval gates.</h2></div>
          <span className="softBadge">No POS/kitchen before approval</span>
        </div>
        <div className="autopilotTimeline">
          {dashboard?.autopilotTimeline?.map(event => <article className={`autoStep ${event.status}`} key={event.type}>
            <i />
            <div><b>{event.label}</b><p>{event.summary}</p><small>{event.status}</small></div>
          </article>)}
        </div>
      </section>

      <section className="agentConsole" id="agent-config">
        <div className="sectionHeader">
          <div><p className="eyebrow">Agent ownership</p><h2>Every agent is visible, editable, and owner-gated.</h2></div>
          <div className="ownerAuthBox"><label>Owner token <input type="password" value={ownerToken} onChange={e => updateOwnerToken(e.target.value)} placeholder="Required for save/approve" autoComplete="off" /></label><button className="primary" onClick={saveAgentConfig}>{configSaved ? 'Saved' : 'Save config'}</button></div>
        </div>
        <div className="agentGrid">{agentDrafts.map(agent => <article className={agent.enabled ? 'agentCard enabled' : 'agentCard'} key={agent.id}>
          <div className="agentTop"><div><small>{agent.id}</small><h3>{agent.name}</h3></div><label className="switch"><input type="checkbox" checked={agent.enabled} onChange={e => updateAgent(agent.id, { enabled: e.target.checked })} /><span /></label></div>
          <label>Mode <select value={agent.mode} onChange={e => updateAgent(agent.id, { mode: e.target.value })}><option value="owner_approval">Owner approval</option><option value="suggest_only">Suggest only</option><option value="telegram_first">Telegram first</option><option value="always_on">Always on</option><option value="paused">Paused</option></select></label>
          <label>Tone <select value={agent.tone} onChange={e => updateAgent(agent.id, { tone: e.target.value })}><option value="warm_direct">Warm + direct</option><option value="playful">Playful</option><option value="concise">Concise</option><option value="silent">Silent/audit only</option></select></label>
          <label>Daily limit <input type="number" min="0" value={agent.dailyLimit} onChange={e => updateAgent(agent.id, { dailyLimit: Number(e.target.value) })} /></label>
          <label>Goal <textarea value={agent.goal} onChange={e => updateAgent(agent.id, { goal: e.target.value })} /></label>
        </article>)}</div>
        <p className="configNote">Config storage: {configStatus}. Agents still require owner approval before POS/kitchen or customer-impacting side effects.</p>
      </section>
    </>}

  </main>;
}
