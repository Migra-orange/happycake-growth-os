import { useEffect, useMemo, useState } from 'react';
import type { AssistantResponse } from '../shared/schema';

type Product = { id:string; name:string; shortName:string; priceUsd:number; weight:string; serves:string; availabilityPolicy:string; tags:string[]; image:string; description:string };
type GrowthModel = { campaigns:{id:string;name:string;budgetUsd:number;channels:string[];promise:string;kpi:string}[] };
type Channel = 'website' | 'instagram' | 'whatsapp';
type Offer = { label:string; value:string; code:string; angle:string };
type Dashboard = { ok:boolean; mode:string; updatedAt:string; storageMode?:string; metrics:Record<string, number>; funnel:{label:string;value:number}[]; channels:{label:string;orders:number;revenueUsd:number}[]; topProducts:{name:string;orders:number;revenueUsd:number}[]; mcpChecks:{ok:boolean;source:string;tool:string;latencyMs:number}[]; agents:AgentConfig[]; autopilotTimeline?:AutopilotEvent[]; approvalQueue?:ApprovalQueueItem[] };
type AgentConfig = { id:string; name:string; enabled:boolean; mode:string; tone:string; dailyLimit:number; goal:string };
type AutopilotEvent = { type:string; label:string; summary:string; status:string };
type ApprovalQueueItem = { approvalId:string; intentId:string; customer:string; status:string; riskFlags:string[]; policyDecision:string; summary:string; proposedSideEffects:string[]; expiresIn:string; decisionAt?:string; decisionSource?:string; executedSideEffects?:string[] };
type AgentConfigResponse = { ok:boolean; agents:AgentConfig[]; version:number; updatedAt:string; storageMode:string; durableConfigured:boolean; ownerAuthEnabled:boolean };

const API = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:8787' : '');

const offers: Offer[] = [
  { label: '$5 off today', value: 'Apply a $5 online sweetness credit', code: 'SWEET5', angle: 'discount' },
  { label: 'Free candles', value: 'Add a small candle set to the box', code: 'CANDLES', angle: 'gift' },
  { label: 'Office treat', value: '10% off a second cake for the same office order', code: 'OFFICE10', angle: 'b2b' },
  { label: 'Priority request', value: 'Move this order request into the priority review lane', code: 'FASTBOX', angle: 'urgency' },
  { label: 'Comeback card', value: 'Add a repeat-order reminder card for next celebration', code: 'MEMORY', angle: 'retention' },
  { label: 'Surprise note', value: 'Add a handwritten gift note to the box', code: 'NOTE', angle: 'gift' }
];

const shopTrustPoints = [
  { stage: '1', title: 'Pick your cake', detail: 'Classic HappyCake flavors with clear prices, size, and serving info.' },
  { stage: '2', title: 'Spin for a treat', detail: 'Unlock a small perk before sending your request.' },
  { stage: '3', title: 'Get confirmation', detail: 'The bakery confirms availability, pickup, and final details before fulfillment.' }
];

const ownerWorkstreams = [
  { label: 'Cold lead mining', owner: 'Local demand scout', action: 'Finds local moments the owner can attack today.' },
  { label: 'Content + ads', owner: 'Content + ad agent', action: 'Drafts posts, Google updates, and micro-campaigns for approval.' },
  { label: 'Website conversion', owner: 'Site conversion agent', action: 'Turns cake shoppers into structured order requests.' },
  { label: 'Customer support', owner: 'Customer support agent', action: 'Tracks pickup/support/review loops after the order.' }
];

const actionLabels: Record<string, string> = {
  lead_received: 'Order started',
  mcp_tool_called: 'Sandbox checked',
  source_checked: 'Catalog and kitchen checked',
  order_intent_created: 'Order intent created',
  owner_approval_requested: 'Bakery review queued',
  owner_approved: 'Bakery confirmed',
  pos_order_created: 'Order handoff ready',
  kitchen_ticket_created: 'Cake prep queued',
  customer_reply_sent: 'Reply prepared'
};

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
  const [result, setResult] = useState<AssistantResponse | null>(null);
  const [ownerResult, setOwnerResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTrail, setShowTrail] = useState(false);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [agentDrafts, setAgentDrafts] = useState<AgentConfig[]>([]);
  const [configSaved, setConfigSaved] = useState(false);
  const [configStatus, setConfigStatus] = useState('loading server config');
  const [ownerToken, setOwnerToken] = useState('');

  useEffect(() => {
    fetch('/data/products.json').then(r => r.json()).then(d => setProducts(d.products));
    fetch('/data/growth-model.json').then(r => r.json()).then(setGrowth).catch(() => {});
    refreshDashboard();
    const seen = localStorage.getItem('happycake-offer-seen');
    setOwnerToken(localStorage.getItem('happycake-owner-token') || '');
    const ownerRoute = window.location.hash === '#owner' || window.location.search.includes('owner=1');
    const timer = window.setTimeout(() => { if (!seen && !ownerRoute) setWheelOpen(true); }, 850);
    return () => window.clearTimeout(timer);
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
    setSpinning(true);
    window.setTimeout(() => {
      const next = offers[Math.floor(Math.random() * offers.length)];
      setOffer(next);
      setSpinning(false);
      localStorage.setItem('happycake-offer-seen', '1');
    }, 1050);
  }

  function startOrder(product: Product) {
    setSelected(product);
    setNote(`I would like ${product.name}${offer ? ` with code ${offer.code}` : ''}.`);
    document.getElementById('order')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function submitOrder() {
    const product = selected || featured;
    if (!product) return;
    const request = `Order request: ${product.name}, ${product.weight}, $${product.priceUsd}. Pickup: ${pickup}. Headcount: ${headcount}. ${offer ? `Offer code: ${offer.code} — ${offer.value}. ` : ''}${note}`;
    setLoading(true);
    setOwnerResult('');
    const res = await fetch(`${API}/api/assistant`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel, customerName: name || undefined, message: request, source: 'happycake-shop-catalog', requireOwnerApproval: true, productId: product.id, offerCode: offer?.code }) });
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
        <h2>Spin for today’s HappyCake treat.</h2>
        <p className="offerLead">A small reason to order now — discount, gift note, candles, or priority owner review.</p>
        <button className={`wheel ${spinning ? 'spinning' : ''}`} onClick={spinOffer} aria-label="Spin offer wheel">
          {offers.map((o, i) => <span key={o.code} style={{ transform: `rotate(${i * 60}deg)` }}>{o.label}</span>)}
          <b>{spinning ? 'Spinning…' : offer ? offer.label : 'SPIN'}</b>
        </button>
        {offer && <div className="wonOffer"><small>Your code</small><strong>{offer.code}</strong><p>{offer.value}. Owner confirms final availability and pickup.</p><button className="primary" onClick={() => setWheelOpen(false)}>Shop with this offer</button></div>}
      </div>
    </div>}

    <nav className="topbar">
      <button className="brandMark" onClick={() => setView('shop')} aria-label="HappyCake shop">
        <img src="/assets/logo/happy-cake-logo-256.png" alt="" />
        <span><b>HappyCake</b><small>Sugar Land cake shop</small></span>
      </button>
      <div className="navActions">
        <button className={view === 'shop' ? 'active' : 'ghost'} onClick={() => { setView('shop'); history.replaceState(null, '', '/'); }}>Shop cakes</button>
        <button className={view === 'owner' ? 'active' : 'ghost'} onClick={() => { setView('owner'); history.replaceState(null, '', '#owner'); }}>Owner</button>
      </div>
    </nav>

    {view === 'shop' && <>
      <section className="shopHero">
        <div className="heroText">
          <p className="eyebrow">Sugar Land cake shop</p>
          <h1>Choose a cake. Spin your treat. Send the request.</h1>
          <p className="lead">Classic HappyCake flavors with clear prices, soft order perks, and a simple request flow. Pick your cake now — the bakery confirms pickup and final details before fulfillment.</p>
          <div className="heroActions"><a className="primary" href="#catalog">Shop cakes</a><button className="secondary" onClick={() => setWheelOpen(true)}>Spin the treat wheel</button></div>
          {offer && <div className="offerRibbon"><span>{offer.code}</span>{offer.value}</div>}
        </div>
        <div className="heroShowcase">
          <img className="showcaseMain" src="/assets/hero/happy-cake-hero-02.webp" alt="HappyCake cakes" />
          {featured && <div className="heroProductCard"><img src={featured.image} alt={featured.name}/><div><small>Featured</small><b>{featured.name}</b><span>${featured.priceUsd} · {featured.weight}</span></div></div>}
        </div>
      </section>

      <section className="funnelMap">
        {shopTrustPoints.map(point => <article key={point.stage}><small>{point.stage}</small><b>{point.title}</b><p>{point.detail}</p></article>)}
      </section>

      <section className="promoRail">
        <button onClick={() => setWheelOpen(true)}><b>Spin the wheel</b><span>Discount, candles, note, or priority request.</span></button>
        <button onClick={() => featured && startOrder(featured)}><b>Featured cake</b><span>{featured ? `${featured.name} · $${featured.priceUsd}` : 'Pick a classic cake'}</span></button>
        <button onClick={() => document.getElementById('order')?.scrollIntoView({ behavior: 'smooth' })}><b>Fast request</b><span>Send pickup window, guests, and occasion.</span></button>
      </section>

      <section className="catalogSection" id="catalog">
        <div className="sectionHeader"><div><p className="eyebrow">Menu</p><h2>Classic cakes, priced clearly.</h2></div><p>Pickup time and availability still get owner confirmation before the promise goes out.</p></div>
        <div className="catalogGrid">{products.map((p, i) => <article className={`cakeCard cakeCard${i}`} key={p.id}>
          <button className="photoButton" onClick={() => startOrder(p)}><img src={p.image} alt={p.name}/><span>{p.tags[0]}</span></button>
          <div className="cakeInfo"><div><h3>{p.name}</h3><p>{p.description}</p></div><div className="cakeMeta"><b>${p.priceUsd}</b><span>{p.weight} · {p.serves}</span></div><button className="orderButton" onClick={() => startOrder(p)}>Order this cake</button></div>
        </article>)}</div>
      </section>

      <section className="orderStage" id="order">
        <div className="orderSummary">
          <p className="eyebrow">Order request</p>
          <h2>{selected ? selected.name : 'Choose a cake to start.'}</h2>
          {selected ? <><img src={selected.image} alt={selected.name}/><div className="priceLine"><b>${selected.priceUsd}</b><span>{selected.weight} · {selected.serves}</span></div></> : <p>Select any cake above. We’ll prepare your request and ask the bakery to confirm details before anything is finalized.</p>}
          {offer && <div className="offerApplied"><b>{offer.code}</b><span>{offer.value}</span></div>}
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
      </section>

      {result && <section className="replyPanel premiumResult">
        <div className="replyDraft"><span className="softBadge">Order request sent</span><h2>Customer reply</h2><p>{result.reply}</p></div>
        <div className="realityBox"><div className="sectionHeader"><h2>What happens next</h2><button className="linkButton" onClick={() => setShowTrail(!showTrail)}>{showTrail ? 'Hide' : 'Show'}</button></div><div className="checkGrid"><span>Menu</span><span>Price</span><span>Pickup</span><span>Confirm</span></div>{showTrail && <ol className="trustTimeline">{result.actions.map((a,i)=><li key={i}><i /> <span><b>{actionLabels[a.type] || 'Checked'}</b><small>{a.detail.replace(/simulated · /g, '').replace(/^MCP: /, '').replace(/owner/gi, 'bakery').replace(/POS/gi, 'order system').replace(/MCP/gi, 'system')}</small></span></li>)}</ol>}</div>
      </section>}

      <section className="marketingSection">
        <div><p className="eyebrow">Why order here</p><h2>Simple cake buying, not back-and-forth guessing.</h2></div>
        <div className="hookGrid"><article><b>Clear menu</b><p>See flavor, size, serving estimate, and price before you message.</p></article><article><b>Small perks</b><p>Spin once for candles, a note, a discount, or priority review.</p></article><article><b>Human confirmation</b><p>Pickup time, availability, and special notes are confirmed before fulfillment.</p></article></div>
      </section>
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
