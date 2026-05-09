import { useEffect, useMemo, useState } from 'react';
import type { AssistantResponse } from '../shared/schema';

type Product = { id:string; name:string; shortName:string; priceUsd:number; weight:string; serves:string; availabilityPolicy:string; tags:string[]; image:string; description:string };
type GrowthModel = { campaigns:{id:string;name:string;budgetUsd:number;channels:string[];promise:string;kpi:string}[] };
type Channel = 'website' | 'instagram' | 'whatsapp';
type Offer = { label:string; value:string; code:string; angle:string };

const API = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:8787' : '');

const offers: Offer[] = [
  { label: '$5 off today', value: 'Apply a $5 online sweetness credit', code: 'SWEET5', angle: 'discount' },
  { label: 'Free candles', value: 'Add a small candle set to the box', code: 'CANDLES', angle: 'gift' },
  { label: 'Office treat', value: '10% off a second cake for the same office order', code: 'OFFICE10', angle: 'b2b' },
  { label: 'Priority request', value: 'Put this order request at the top of the owner queue', code: 'FASTBOX', angle: 'urgency' },
  { label: 'Comeback card', value: 'Add a repeat-order reminder card for next celebration', code: 'MEMORY', angle: 'retention' },
  { label: 'Surprise note', value: 'Add a handwritten gift note to the box', code: 'NOTE', angle: 'gift' }
];

const actionLabels: Record<string, string> = {
  lead_received: 'Order started',
  mcp_tool_called: 'Sandbox checked',
  source_checked: 'Catalog and kitchen checked',
  order_intent_created: 'Order intent created',
  owner_approval_requested: 'Owner approval queued',
  owner_approved: 'Owner approved',
  pos_order_created: 'POS handoff ready',
  kitchen_ticket_created: 'Kitchen ticket ready',
  customer_reply_sent: 'Reply prepared'
};

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [growth, setGrowth] = useState<GrowthModel | null>(null);
  const [view, setView] = useState<'shop' | 'owner'>('shop');
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

  useEffect(() => {
    fetch('/data/products.json').then(r => r.json()).then(d => setProducts(d.products));
    fetch('/data/growth-model.json').then(r => r.json()).then(setGrowth).catch(() => {});
    const seen = localStorage.getItem('happycake-offer-seen');
    const timer = window.setTimeout(() => { if (!seen) setWheelOpen(true); }, 850);
    return () => window.clearTimeout(timer);
  }, []);

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
    setResult(await res.json());
    setShowTrail(false);
    setLoading(false);
  }

  async function ownerApprove(action: 'approve_order_handoff' | 'reject_campaign') {
    const res = await fetch(`${API}/api/telegram/owner-action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, intentId: result?.orderIntent?.intentId, approvalId: result?.requiredApprovals?.[0]?.approvalId, campaignId: 'shop-offer', note: result?.ownerSummary || 'Owner reviewed order.' }) });
    const data = await res.json();
    setOwnerResult(data.reply || JSON.stringify(data));
  }

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
        <button className={view === 'shop' ? 'active' : 'ghost'} onClick={() => setView('shop')}>Shop cakes</button>
        <button className={view === 'owner' ? 'active' : 'ghost'} onClick={() => setView('owner')}>Owner</button>
      </div>
    </nav>

    {view === 'shop' && <>
      <section className="shopHero">
        <div className="heroText">
          <p className="eyebrow">Sugar Land · order online</p>
          <h1>Pick the cake. See the price. Send the order.</h1>
          <p className="lead">Real HappyCake classics with photos, weights, and prices. Choose one, add pickup details, and the owner confirms the final handoff.</p>
          <div className="heroActions"><a className="primary" href="#catalog">Shop the menu</a><button className="secondary" onClick={() => setWheelOpen(true)}>Spin for a treat</button></div>
          {offer && <div className="offerRibbon"><span>{offer.code}</span>{offer.value}</div>}
        </div>
        <div className="heroShowcase">
          <img className="showcaseMain" src="/assets/hero/happy-cake-hero-02.webp" alt="HappyCake cakes" />
          {featured && <div className="heroProductCard"><img src={featured.image} alt={featured.name}/><div><small>Featured</small><b>{featured.name}</b><span>${featured.priceUsd} · {featured.weight}</span></div></div>}
        </div>
      </section>

      <section className="promoRail">
        <button onClick={() => setWheelOpen(true)}><b>Spin the wheel</b><span>Unlock a small ordering perk</span></button>
        <button onClick={() => featured && startOrder(featured)}><b>Office birthday?</b><span>Pick cake "Napoleon" for 10</span></button>
        <button onClick={() => products[0] && startOrder(products[0])}><b>Family dinner</b><span>Order cake "Honey" tonight</span></button>
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
          {selected ? <><img src={selected.image} alt={selected.name}/><div className="priceLine"><b>${selected.priceUsd}</b><span>{selected.weight} · {selected.serves}</span></div></> : <p>Select any cake above. The request goes through the live sandbox and waits for owner approval.</p>}
          {offer && <div className="offerApplied"><b>{offer.code}</b><span>{offer.value}</span></div>}
        </div>
        <div className="orderForm">
          <label>Your name <input value={name} onChange={e=>setName(e.target.value)} placeholder="Optional" /></label>
          <label>Reply channel <select value={channel} onChange={e=>setChannel(e.target.value as Channel)}><option value="website">Website</option><option value="instagram">Instagram DM</option><option value="whatsapp">WhatsApp</option></select></label>
          <label>Pickup window <input value={pickup} onChange={e=>setPickup(e.target.value)} /></label>
          <label>Guests <input value={headcount} onChange={e=>setHeadcount(e.target.value)} /></label>
          <label>Note <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Add text on box, occasion, or question." /></label>
          <button className="primary wide" onClick={submitOrder} disabled={loading || !selected}>{loading ? 'Sending order request…' : 'Send order request'}</button>
          <p className="fineprint">Allergens, exact pickup time, and final availability are confirmed by the sandbox/owner before fulfillment.</p>
        </div>
      </section>

      {result && <section className="replyPanel premiumResult">
        <div className="replyDraft"><span className="softBadge">Order request sent</span><h2>Customer reply</h2><p>{result.reply}</p></div>
        <div className="realityBox"><div className="sectionHeader"><h2>Sandbox proof</h2><button className="linkButton" onClick={() => setShowTrail(!showTrail)}>{showTrail ? 'Hide' : 'Show'}</button></div><div className="checkGrid"><span>Catalog</span><span>POS</span><span>Kitchen</span><span>Owner</span></div>{showTrail && <ol className="trustTimeline">{result.actions.map((a,i)=><li key={i}><i /> <span><b>{actionLabels[a.type] || 'Checked'}</b><small>{a.detail.replace(/simulated · /g, '').replace(/^MCP: /, '')}</small></span></li>)}</ol>}</div>
      </section>}

      <section className="marketingSection">
        <div><p className="eyebrow">Growth hooks</p><h2>Not a brochure. A buying machine.</h2></div>
        <div className="hookGrid"><article><b>Wheel offer</b><p>Turns a cold visitor into an active shopper in the first five seconds.</p></article><article><b>Priced catalog</b><p>No vague “ask us” energy. The customer can choose and send an order.</p></article><article><b>Repeat loop</b><p>Offer codes, office orders, and reminder cards create the next purchase.</p></article></div>
      </section>
    </>}

    {view === 'owner' && <>
      <section className="ownerHero">
        <div><p className="eyebrow">Telegram-first owner control</p><h1>Approve orders, promos, and kitchen handoff.</h1><p className="lead">The shop sells directly, but final fulfillment waits for owner control and sandbox evidence.</p></div>
        <div className="modelCard"><small>Live sandbox</small><b>Catalog → POS → kitchen</b><span>Marketing offers and order requests are visible before side effects.</span></div>
      </section>
      <section className="ownerGrid">
        <div className="panel approvalInbox"><div className="sectionHeader"><h2>Approval inbox</h2><span className="softBadge">Telegram preview</span></div>{result ? <div className="approvalCard"><b>{result.orderIntent?.customerName || 'Customer'} · {result.orderIntent?.channel}</b><p>{result.ownerSummary}</p><div className="approvalMeta"><span>Missing: {result.orderIntent?.requiredFieldsMissing?.join(', ') || 'none'}</span><span>Risks: {result.riskFlags?.join(', ') || 'none'}</span></div><div className="approvalButtons"><button onClick={() => ownerApprove('approve_order_handoff')}>Approve handoff</button><button className="secondary" onClick={() => setShowTrail(true)}>Open proof</button><button className="danger" onClick={() => ownerApprove('reject_campaign')}>Reject</button></div></div> : <div className="emptyState"><b>No order yet.</b><p>Send an order from the shop to create the first approval card.</p><button onClick={() => setView('shop')}>Open shop</button></div>}{ownerResult && <p className="ownerToast">{ownerResult}</p>}</div>
        <div className="panel dailyBrief"><h2>Today’s levers</h2><ul><li><b>First visit</b><span>Wheel offer captures intent.</span></li><li><b>Basket</b><span>Office second-cake promo.</span></li><li><b>Repeat</b><span>Comeback card and reminder offer.</span></li></ul></div>
        <div className="panel campaignPlan"><h2>Campaign queue</h2>{growth?.campaigns?.map(c => <div className="campaignRow" key={c.id}><b>{c.name}</b><span>{c.channels.join(', ')}</span><small>{c.promise}</small></div>)}</div>
      </section>
    </>}
  </main>;
}
