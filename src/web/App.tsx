import { useEffect, useMemo, useState } from 'react';
import type { AssistantResponse } from '../shared/schema';

type Product = { id:string; name:string; availabilityPolicy:string; serves:string; tags:string[]; image:string; description:string };
type GrowthModel = { targetMonthlyRevenueUsd:number; currentRangeUsd:number[]; revenueModel:{stream:string;targetUsd:number;mechanism:string}[]; campaigns:{id:string;name:string;budgetUsd:number;channels:string[];promise:string;kpi:string}[] };

const API = import.meta.env.VITE_API_BASE_URL || (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:8787' : '');

export default function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [growth, setGrowth] = useState<GrowthModel | null>(null);
  const [message, setMessage] = useState('I forgot a cake for our office birthday today. Can we pick something up after work?');
  const [channel, setChannel] = useState('instagram');
  const [result, setResult] = useState<AssistantResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/data/products.json').then(r => r.json()).then(d => setProducts(d.products));
    fetch('/data/growth-model.json').then(r => r.json()).then(setGrowth);
  }, []);

  const jsonLd = useMemo(() => ({
    '@context': 'https://schema.org', '@type': 'Bakery', name: 'HappyCake', address: { '@type': 'PostalAddress', addressLocality: 'Sugar Land', addressRegion: 'TX' },
    url: 'https://happycake.us', servesCuisine: 'cakes and desserts', makesOffer: products.map(p => ({ '@type': 'Offer', itemOffered: { '@type': 'Product', name: p.name, description: p.description }, availability: 'https://schema.org/LimitedAvailability' }))
  }), [products]);

  async function run() {
    setLoading(true); setResult(null);
    const res = await fetch(`${API}/api/assistant`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel, message, source: 'website-demo', requireOwnerApproval: true }) });
    setResult(await res.json());
    setLoading(false);
  }

  return <main>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <section className="hero">
      <div>
        <p className="eyebrow">HappyCake · Sugar Land Growth OS</p>
        <h1>Turn local moments into cake orders.</h1>
        <p className="lead">A selling website, AI sales concierge, owner Telegram command center, and $500/month local demand engine designed to grow HappyCake from $15–20k to $40k/month.</p>
        <div className="ctaRow"><a href="#assistant" className="button">Run sales flow</a><a href="/data/growth-model.json" className="button secondary">AI-readable growth model</a></div>
      </div>
      <div className="heroCard">
        <b>Revenue target</b>
        <span>$40k/month</span>
        <small>same-day + B2B + WhatsApp/IG + reviews + reminders</small>
      </div>
    </section>

    <section className="grid two">
      <div className="panel"><h2>Sales funnels</h2><ul><li><b>On the Way Home:</b> same-day cakes for drivers after work/school.</li><li><b>Office Dessert Drop:</b> recurring coordinators in offices, schools, churches.</li><li><b>DM to Kitchen:</b> Instagram/WhatsApp → order intent → POS/kitchen handoff.</li><li><b>Box QR Loop:</b> reviews, referrals, and occasion reminders from every box.</li></ul></div>
      <div className="panel"><h2>$500 marketing engine</h2>{growth?.campaigns.map(c => <div className="mini" key={c.id}><b>{c.name}</b><span>${c.budgetUsd} · {c.channels.join(', ')}</span><small>{c.promise}</small></div>)}</div>
    </section>

    <section><h2>Ready-made classics</h2><div className="products">{products.map(p => <article className="product" key={p.id}><img src={p.image} alt={p.name}/><div><h3>{p.name}</h3><p>{p.description}</p><b>Price + pickup: check today’s source of truth</b><small>{p.serves} · {p.availabilityPolicy.replaceAll('_', ' ')}</small></div></article>)}</div></section>

    <section id="assistant" className="panel assistant"><h2>AI sales concierge demo</h2><p>Runtime rule: Node wrapper calls <code>claude -p</code> when available. If not, deterministic simulator keeps the demo working and marks evidence clearly.</p><div className="form"><select value={channel} onChange={e=>setChannel(e.target.value)}><option value="instagram">Instagram DM</option><option value="whatsapp">WhatsApp</option><option value="website">Website assistant</option><option value="telegram">Owner Telegram</option></select><textarea value={message} onChange={e=>setMessage(e.target.value)} /><button onClick={run} disabled={loading}>{loading ? 'Working…' : 'Run assistant'}</button></div>{result && <div className="result"><span className={`badge ${result.mode}`}>{result.mode}{result.usedFallback ? ' fallback' : ''}</span><h3>Customer reply</h3><p>{result.reply}</p><h3>Owner summary</h3><p>{result.ownerSummary}</p><h3>Actions</h3><ul>{result.actions.map((a,i)=><li key={i}><b>{a.label}:</b> {a.detail}</li>)}</ul></div>}</section>

    <section className="grid three"><div className="panel"><h3>Agent-friendly</h3><p>Products, growth model, and schema are exposed as JSON. Clear prices and constraints prevent brittle scraping.</p></div><div className="panel"><h3>Owner controlled</h3><p>Posts and paid campaigns require Telegram approval before publication.</p></div><div className="panel"><h3>Evidence-first</h3><p>Every demo run writes evidence for lead source, assistant answer, order intent, and handoff.</p></div></section>
  </main>;
}
