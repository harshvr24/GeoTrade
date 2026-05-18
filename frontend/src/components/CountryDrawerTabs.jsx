import React from 'react'

export default function CountryDrawerTabs({ detail }) {
  if (!detail) return null
  const { markets = [], news = [], signals = [] } = detail
  return (
    <div className="drawer-tabs">
      <section className="drawer-card">
        <div className="card-title">Key Markets</div>
        <div className="markets-grid">
          {markets.map(m => (
            <div key={m.symbol} className="market-chip">
              <div className="market-top">
                <span className="market-symbol">{m.symbol}</span>
                <span className="market-sector">{m.sector || 'Market'}</span>
              </div>
              <div className="market-price">{m.price}</div>
              <div className="market-change" style={{ color: m.change_pct >= 0 ? '#22c55e' : '#ef4444' }}>
                {m.change_pct >= 0 ? '+' : ''}{m.change_pct}%
              </div>
            </div>
          ))}
          {markets.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 12 }}>No market data</div>}
        </div>
      </section>

      <section className="drawer-card">
        <div className="card-title">Signals</div>
        <div className="drawer-list">
          {signals.slice(0, 4).map(s => (
            <div key={s.asset} className="drawer-list-item">
              <div className="list-headline">{s.asset} · {s.market}</div>
              <div className="list-meta">
                <span className={`action-badge ${s.action.toLowerCase()}`}>{s.action}</span>
                <span>Conf {Math.round((s.confidence || 0) * 100)}%</span>
                <span>{s.horizon || s.timeframe || ''}</span>
              </div>
              <div className="list-impact">{s.rationale}</div>
            </div>
          ))}
          {signals.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 12 }}>No signals</div>}
        </div>
      </section>

      <section className="drawer-card">
        <div className="card-title">Live News</div>
        <div className="drawer-list">
          {news.slice(0, 4).map(n => (
            <div key={n.id} className="drawer-list-item">
              <div className="list-headline">{n.headline}</div>
              <div className="list-meta">
                <span>{n.source}</span>
                <span>{new Date(n.timestamp).toISOString().slice(11,16)} UTC</span>
                <span className={`sev-dot ${n.severity?.toLowerCase?.() || 'low'}`} />
              </div>
              <div className="list-impact">{n.impact}</div>
            </div>
          ))}
          {news.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 12 }}>No news</div>}
        </div>
      </section>
    </div>
  )
}
