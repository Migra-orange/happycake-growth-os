import { useEffect, useMemo, useState } from 'react';
import type { AssistantResponse } from '../shared/schema';

type Product = { id:string; name:string; availabilityPolicy:string; serves:string; tags:string[]; image:string; description:string };
type GrowthModel = { targetMonthlyRevenueUsd:number; currentRangeUsd:number[]; revenueModel:{stream:string;targetUsd:number;mechanism:string}[]; campaigns:{id:string;name:string;budgetUsd:number;channels:string[];promise:string;kpi:string}[] };

const API = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:8787' : '');

const customerPrompts = [
  'I need a cake today after work for 8 people.',
  'Our office has birthdays every Friday. Can you help us plan dessert?',
  'I forgot my wife’s birthday cake. I need something simple and nice today.'
];

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [growth, setGrowth] = useState<GrowthModel | null>(null);
  const [view, setView] = useState<'customer' | 'owner'>('customer');
  const [message, setMessage] = useState(customerPrompts[0]);
  const [channel, setChannel] = useState('website');
  const [name, setName] = useState('');
  const [result, setResult] = useState<AssistantResponse | null>(null);
  const [ownerResult, setOwnerResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/data/products.json').then(r => r.json()).then(d => setProducts(d.products));
    fetch('/data/growth-model.json').then(r => r.json()).then(setGrowth);
  }, []);

  const jsonLd = useMemo(() => ({
    '@context': 'https://schema.org', '@type': 'Bakery', name: 'HappyCake', address: { '@type': 'PostalAddress', addressLocality: 'Sugar Land', addressRegion: 'TX' },
    url: 'https://happycake.us', servesCuisine: 'cakes and desserts', makesOffer: products.map(p => ({ '@type': 'Offer', itemOffered: { '@type': 'Product', name: p.name, description: p.description }, availability: 'https://schema.org/LimitedAvailability' }))
  }), [products]);

  async function runSalesFlow(customMessage = message) {
    setLoading(true); setResult(null);
    const res = await fetch(`${API}/api/assistant`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel, customerName: name || undefined, message: customMessage, source: 'vercel-customer-site', requireOwnerApproval: true }) });
    setResult(await res.json());
    setLoading(false);
  }

  async function ownerApprove(action: 'approve' | 'reject') {
    const res = await fetch(`${API}/api/telegram/owner-action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, campaignId: 'office-drop', note: result?.ownerSummary || 'Owner reviewed campaign/lead.' }) });
    const data = await res.json();
    setOwnerResult(data.reply || JSON.stringify(data));
  }

  return <main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

    <nav className="topbar">
      <div className="brand"><span>HappyCake</span><small>Sugar Land</small></div>
      <div className="navActions">
        <button className={view === 'customer' ? 'active' : 'ghost'} onClick={() => setView('customer')}>Customer site</button>
        <button className={view === 'owner' ? 'active' : 'ghost'} onClick={() => setView('owner')}>Owner cockpit</button>
      </div>
    </nav>

    {view === 'customer' && <>
      <section className="customerHero">
        <div className="heroCopy">
          <p className="eyebrow">Ready-made classic cakes · Sugar Land</p>
          <h1>Need a cake today?</h1>
          <p className="lead">Tell HappyCake what the occasion is. We’ll help you pick a ready-made classic cake, confirm today’s availability, and hand it to the owner before anyone promises price or pickup.</p>
          <div className="quickChips">{customerPrompts.map(p => <button className="chip" key={p} onClick={() => { setMessage(p); runSalesFlow(p); }}>{p}</button>)}</div>
        </div>
        <div className="orderCard" id="order">
          <div className="cardHeader"><span>Start here</span><b>2 min cake request</b></div>
          <label>Your name <input value={name} onChange={e=>setName(e.target.value)} placeholder="Optional" /></label>
          <label>Channel <select value={channel} onChange={e=>setChannel(e.target.value)}><option value="website">Website</option><option value="instagram">Instagram DM</option><option value="whatsapp">WhatsApp</option></select></label>
          <label>What do you need? <textarea value={message} onChange={e=>setMessage(e.target.value)} /></label>
          <button className="primary" onClick={() => runSalesFlow()} disabled={loading}>{loading ? 'Checking…' : 'Ask HappyCake'}</button>
          <p className="fineprint">No fake prices. No fake inventory. Final confirmation comes from today’s source of truth / owner.</p>
        </div>
      </section>

      {result && <section className="replyPanel">
        <div><span className={`badge ${result.mode}`}>{result.mode}{result.usedFallback ? ' demo' : ''}</span><h2>Customer sees this</h2><p>{result.reply}</p></div>
        <div><h2>What happens behind the scenes</h2><ul>{result.actions.map((a,i)=><li key={i}><b>{a.label}</b><span>{a.detail}</span></li>)}</ul></div>
      </section>}

      <section className="steps">
        <h2>How ordering works</h2>
        <div className="stepGrid"><div><b>1</b><h3>Say the occasion</h3><p>Birthday, office, school, family dinner, last-minute pickup.</p></div><div><b>2</b><h3>We check reality</h3><p>Inventory, price, pickup time, and limits come from owner/POS — not AI guessing.</p></div><div><b>3</b><h3>Pick up happy</h3><p>Ready-made classics first, simple handoff, review/reminder loop after the box leaves.</p></div></div>
      </section>

      <section><h2>Popular ready-made classics</h2><div className="products">{products.map(p => <article className="product" key={p.id}><img src={p.image} alt={p.name}/><div><h3>{p.name}</h3><p>{p.description || 'A HappyCake ready-made classic.'}</p><b>Confirm price + pickup today</b><small>{p.serves || 'Servings vary'} · {p.availabilityPolicy.replaceAll('_', ' ')}</small></div></article>)}</div></section>
    </>}

    {view === 'owner' && <>
      <section className="ownerHero">
        <div><p className="eyebrow">Owner cockpit</p><h1>See leads, approve campaigns, grow repeat orders.</h1><p className="lead">This is the owner-side view: incoming cake requests, Telegram approval, $500/month marketing engine, and evidence for what drove revenue.</p></div>
        <div className="metricStack"><div><small>Target</small><b>$40k/mo</b></div><div><small>Current</small><b>${growth?.currentRangeUsd?.[0]?.toLocaleString() || '15k'}–${growth?.currentRangeUsd?.[1]?.toLocaleString() || '20k'}</b></div><div><small>Monthly ad budget</small><b>$500</b></div></div>
      </section>

      <section className="dashboard">
        <div className="panel leadQueue"><h2>Lead queue</h2>{[
          ['Urgent pickup', 'Customer needs cake after work today', 'Needs inventory check'],
          ['Office coordinator', 'Recurring Friday dessert drop', 'High-value B2B lead'],
          ['Birthday reminder', 'Customer opted into date reminder', 'Future repeat order']
        ].map(([title, body, tag]) => <div className="leadItem" key={title}><div><b>{title}</b><span>{body}</span></div><small>{tag}</small></div>)}</div>

        <div className="panel"><h2>Telegram approval card</h2><p>{result?.ownerSummary || 'Run a customer request first, then the owner sees the summary here.'}</p><div className="approvalButtons"><button onClick={() => ownerApprove('approve')}>Approve</button><button className="danger" onClick={() => ownerApprove('reject')}>Reject</button></div>{ownerResult && <p className="ownerToast">{ownerResult}</p>}</div>

        <div className="panel"><h2>$500 growth engine</h2>{growth?.campaigns.map(c => <div className="mini" key={c.id}><b>{c.name}</b><span>${c.budgetUsd} · {c.channels.join(', ')}</span><small>{c.promise}</small></div>)}</div>
      </section>

      <section className="grid three"><div className="panel"><h3>Customer funnel</h3><p>Website / IG / WhatsApp turns vague cake demand into structured order intent.</p></div><div className="panel"><h3>Owner control</h3><p>No post, price, or availability goes out without approval/source-of-truth.</p></div><div className="panel"><h3>Evidence</h3><p>Every lead has channel, response, action, and owner decision for evaluator/business review.</p></div></section>
    </>}
  </main>;
}
