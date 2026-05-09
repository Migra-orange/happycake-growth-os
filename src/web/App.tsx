import { useEffect, useMemo, useState } from 'react';
import type { AssistantResponse } from '../shared/schema';

type Product = { id:string; name:string; availabilityPolicy:string; serves:string; tags:string[]; image:string; description:string };
type GrowthModel = { targetMonthlyRevenueUsd:number; currentRangeUsd:number[]; campaigns:{id:string;name:string;budgetUsd:number;channels:string[];promise:string;kpi:string}[] };
type Channel = 'website' | 'instagram' | 'whatsapp';

const API = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:8787' : '');

const occasions = [
  { title: 'On the way home', detail: 'A cake for tonight, checked against today’s bake.', prompt: 'I need a classic cake today after work for 8 people.', image: '/assets/social/happy-cake-social-03.webp' },
  { title: 'Office Friday', detail: 'Dessert for a team, with owner-approved handoff.', prompt: 'Our office has birthdays every Friday. Can you help us plan dessert for 12 people?', image: '/assets/social/happy-cake-social-01.webp' },
  { title: 'Birthday rescue', detail: 'Simple, classic, same-day if the kitchen says yes.', prompt: 'I forgot a birthday cake. I need something simple and nice today.', image: '/assets/social/happy-cake-social-04.webp' }
];

const actionLabels: Record<string, string> = {
  lead_received: 'Request received',
  mcp_tool_called: 'Source checked',
  source_checked: 'Bake, timing, and policy checked',
  order_intent_created: 'Cake request shaped',
  owner_approval_requested: 'Owner confirmation queued',
  owner_approved: 'Owner approved',
  pos_order_created: 'Order handoff ready',
  kitchen_ticket_created: 'Kitchen note ready',
  customer_reply_sent: 'Reply prepared'
};

const policyLabels: Record<string, string> = {
  check_today_bake: 'Check today’s bake',
  limited_check_required: 'Limited · check first',
  owner_or_pos_check_required: 'Owner confirmed'
};

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [growth, setGrowth] = useState<GrowthModel | null>(null);
  const [view, setView] = useState<'customer' | 'owner'>('customer');
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState<Channel>('website');
  const [name, setName] = useState('');
  const [result, setResult] = useState<AssistantResponse | null>(null);
  const [ownerResult, setOwnerResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTrail, setShowTrail] = useState(false);

  useEffect(() => {
    fetch('/data/products.json').then(r => r.json()).then(d => setProducts(d.products));
    fetch('/data/growth-model.json').then(r => r.json()).then(setGrowth);
  }, []);

  const jsonLd = useMemo(() => ({
    '@context': 'https://schema.org', '@type': 'Bakery', name: 'HappyCake', address: { '@type': 'PostalAddress', addressLocality: 'Sugar Land', addressRegion: 'TX' },
    url: 'https://happycake.us', servesCuisine: 'cakes and desserts', makesOffer: products.map(p => ({ '@type': 'Offer', itemOffered: { '@type': 'Product', name: p.name, description: p.description }, availability: 'https://schema.org/LimitedAvailability' }))
  }), [products]);

  async function runSalesFlow(customMessage = message) {
    const request = customMessage.trim();
    if (!request) return;
    setLoading(true);
    setOwnerResult('');
    const res = await fetch(`${API}/api/assistant`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel, customerName: name || undefined, message: request, source: 'happycake-storefront', requireOwnerApproval: true }) });
    setResult(await res.json());
    setShowTrail(false);
    setLoading(false);
  }

  async function ownerApprove(action: 'approve_order_handoff' | 'reject_campaign') {
    const res = await fetch(`${API}/api/telegram/owner-action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, intentId: result?.orderIntent?.intentId, approvalId: result?.requiredApprovals?.[0]?.approvalId, campaignId: 'office-drop', note: result?.ownerSummary || 'Owner reviewed request.' }) });
    const data = await res.json();
    setOwnerResult(data.reply || JSON.stringify(data));
  }

  function chooseOccasion(prompt: string) {
    setMessage(prompt);
    document.getElementById('request')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function requestProduct(product: Product) {
    setMessage(`Can I check today’s availability for ${product.name}? I need it for a celebration.`);
    document.getElementById('request')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return <main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

    <nav className="topbar">
      <button className="brandMark" onClick={() => setView('customer')} aria-label="HappyCake storefront">
        <img src="/assets/logo/happy-cake-logo-256.png" alt="" />
        <span><b>HappyCake</b><small>Sugar Land · Today’s bake</small></span>
      </button>
      <div className="navActions">
        <button className={view === 'customer' ? 'active' : 'ghost'} onClick={() => setView('customer')}>Storefront</button>
        <button className={view === 'owner' ? 'active' : 'ghost'} onClick={() => setView('owner')}>Owner demo</button>
      </div>
    </nav>

    {view === 'customer' && <>
      <section className="heroShell">
        <div className="heroCopy">
          <p className="eyebrow">Sugar Land · ready-made classics</p>
          <h1>Today’s bake, ready for the moments that matter.</h1>
          <p className="lead">Tell us the occasion, pickup window, and headcount. HappyCake checks today’s bake before confirming what’s possible.</p>
          <div className="heroActions"><a className="primary" href="#request">Check today’s bake</a></div>
        </div>
        <div className="heroGallery" aria-label="HappyCake cakes">
          <img className="heroMain" src="/assets/hero/happy-cake-hero-01.webp" alt="HappyCake cake display" />
          <img className="heroFloat" src="/assets/products/happy-cake-product-02.webp" alt="Classic cake" />
          <div className="promiseSeal"><b>Checked first</b><span>no guessed price, pickup, or availability</span></div>
        </div>
      </section>

      <section className="occasionStrip">
        {occasions.map(o => <button className="occasionTile" key={o.title} onClick={() => chooseOccasion(o.prompt)}>
          <img src={o.image} alt="" /><span><b>{o.title}</b><small>{o.detail}</small></span>
        </button>)}
      </section>

      <section className="requestStage" id="request">
        <div className="requestIntro"><p className="eyebrow">Concierge request</p><h2>One calm check before anyone makes a promise.</h2><p>Availability, pickup timing, policies, and special questions are confirmed from the source of truth or by the owner.</p></div>
        <div className="requestCard">
          <label>Your name <input value={name} onChange={e=>setName(e.target.value)} placeholder="Optional" /></label>
          <label>Where should we reply? <select value={channel} onChange={e=>setChannel(e.target.value as Channel)}><option value="website">Website</option><option value="instagram">Instagram DM</option><option value="whatsapp">WhatsApp</option></select></label>
          <label>Occasion, pickup window, headcount <textarea value={message} onChange={e=>setMessage(e.target.value)} placeholder="Example: I need a Napoleon cake today after work for 10 people." /></label>
          <button className="primary wide" onClick={() => runSalesFlow()} disabled={loading || !message.trim()}>{loading ? 'Checking today’s bake…' : 'Check today’s bake'}</button>
          <p className="fineprint">Prices, hours, allergens, delivery, and pickup are confirmed before they are promised.</p>
        </div>
      </section>

      {result && <section className="replyPanel premiumResult">
        <div className="replyDraft"><span className="softBadge">Ready for owner confirmation</span><h2>Reply draft</h2><p>{result.reply}</p></div>
        <div className="realityBox"><div className="sectionHeader"><h2>What we checked</h2><button className="linkButton" onClick={() => setShowTrail(!showTrail)}>{showTrail ? 'Hide details' : 'Show details'}</button></div><div className="checkGrid"><span>Today’s bake</span><span>Pickup timing</span><span>Kitchen</span><span>Owner</span></div>{showTrail && <ol className="trustTimeline">{result.actions.map((a,i)=><li key={i}><i /> <span><b>{actionLabels[a.type] || 'Checked'}</b><small>{a.detail.replace(/simulated · /g, '').replace(/public Vercel keeps tokens server-side/g, 'details kept private').replace(/^MCP: /, '')}</small></span></li>)}</ol>}</div>
      </section>}

      <section className="promiseSection"><h2>How HappyCake keeps promises honest.</h2><div className="stepGrid"><article><b>01</b><h3>Tell us the moment</h3><p>Birthday, office, school, family dinner, or a cake on the way home.</p></article><article><b>02</b><h3>We check reality</h3><p>Today’s bake, inventory, policies, and kitchen capacity are checked before the reply.</p></article><article><b>03</b><h3>Owner confirms</h3><p>The owner approves the handoff before customer-facing promises go out.</p></article></div></section>

      <section className="productSection"><div className="sectionHeader"><div><p className="eyebrow">Ready-made classics</p><h2>Choose the feeling. We’ll check the details.</h2></div></div><div className="products">{products.map(p => <article className="product" key={p.id}><button onClick={() => requestProduct(p)}><img src={p.image} alt={p.name}/></button><div><div className="tagRow">{p.tags.slice(0,2).map(t => <small key={t}>{t}</small>)}</div><h3>{p.name}</h3><p>{p.description}</p><button className="textCta" onClick={() => requestProduct(p)}>{policyLabels[p.availabilityPolicy] || 'Check availability'} →</button></div></article>)}</div></section>
    </>}

    {view === 'owner' && <>
      <section className="ownerHero">
        <div><p className="eyebrow">Telegram-first owner control</p><h1>The day’s decisions, ready for approval.</h1><p className="lead">Leads, source checks, campaign drafts, and kitchen handoffs stay in one workflow. Nothing publishes or promises without owner control.</p></div>
        <div className="modelCard"><small>Private operating view</small><b>Approval before promise.</b><span>Primary lever: same-day classics and recurring office orders, controlled from Telegram.</span></div>
      </section>

      <section className="ownerGrid">
        <div className="panel approvalInbox"><div className="sectionHeader"><h2>Approval inbox</h2><span className="softBadge">Telegram preview</span></div>{result ? <div className="approvalCard"><b>{result.orderIntent?.customerName || 'Customer'} · {result.orderIntent?.channel}</b><p>{result.ownerSummary}</p><div className="approvalMeta"><span>Missing: {result.orderIntent?.requiredFieldsMissing?.join(', ') || 'none'}</span><span>Risks: {result.riskFlags?.join(', ') || 'none'}</span></div><div className="approvalButtons"><button onClick={() => ownerApprove('approve_order_handoff')}>Send reply</button><button className="secondary" onClick={() => setShowTrail(true)}>Open trust trail</button><button className="danger" onClick={() => ownerApprove('reject_campaign')}>Can’t fulfill</button></div></div> : <div className="emptyState"><b>No approval yet.</b><p>Run a customer request to create the first owner approval card.</p><button onClick={() => setView('customer')}>Open storefront</button></div>}{ownerResult && <p className="ownerToast">{ownerResult}</p>}</div>
        <div className="panel dailyBrief"><h2>Daily brief</h2><ul><li><b>Today’s demand angle</b><span>Same-day ready-made classics after work.</span></li><li><b>Kitchen risk</b><span>Same-day requests require owner confirmation.</span></li><li><b>Trust trail</b><span>{result ? `${result.actions.length} recorded events` : 'Waiting for first request'}</span></li></ul></div>
        <div className="panel campaignPlan"><h2>Local demand plan</h2>{growth?.campaigns.map(c => <div className="campaignRow" key={c.id}><b>{c.name}</b><span>{c.channels.join(', ')}</span><small>{c.promise}</small></div>)}</div>
      </section>
    </>}
  </main>;
}
