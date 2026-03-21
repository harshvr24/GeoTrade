import React from 'react'

export default function CountryDrawer({ detail, loading, onClose }) {
  if (!detail && !loading) return null

  const marketColor = (v) => v >= 0 ? '#22c55e' : '#ef4444'

  return (
    <div className="country-drawer">
      <div className="drawer-header">
        <div>
          <div className="drawer-label">Country Focus</div>
          {detail && (
            <div className="drawer-title">
              {detail.country.country_name}
              <span className="drawer-risk" data-level={detail.country.risk_level.toLowerCase()}>
                {detail.country.risk_level}
              </span>
            </div>
          )}
          {loading && <div className="drawer-sub">Loading latest news & markets…</div>}
          {detail && !loading && (
            <div className="drawer-sub">
              {detail.country.region} · Events: {detail.events.length} · Signals: {detail.signals.length}
            </div>
          )}
        </div>
        <button className="drawer-close" onClick={onClose}>×</button>
      </div>

      {loading && (
        <div className="drawer-loading">Fetching live data…</div>
      )}

      {detail && !loading && (
        <div className="drawer-grid">
          <section className="drawer-card">
            <div className="card-title">Latest News</div>
            <div className="drawer-list">
              {detail.news.map(n => (
                <div key={n.id} className="drawer-list-item">
                  <div className="list-headline">{n.headline}</div>
                  <div className="list-meta">
                    <span>{n.source}</span>
                    <span>{new Date(n.timestamp).toISOString().slice(11,16)} UTC</span>
                    <span className={`sev-dot ${n.severity.toLowerCase()}`} />
                  </div>
                  <div className="list-impact">{n.impact}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="drawer-card">
            <div className="card-title">Major Markets</div>
            <div className="markets-grid">
              {detail.markets.map(m => (
                <div key={m.symbol} className="market-chip">
                  <div className="market-top">
                    <span className="market-symbol">{m.symbol}</span>
                    <span className="market-sector">{m.sector || 'Market'}</span>
                  </div>
                  <div className="market-price">{m.price}</div>
                  <div className="market-change" style={{ color: marketColor(m.change_pct) }}>
                    {m.change_pct > 0 ? '+' : ''}{m.change_pct}%
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="drawer-card">
            <div className="card-title">Signals</div>
            <div className="drawer-list">
              {detail.signals.slice(0,4).map(s => (
                <div key={s.asset} className="drawer-list-item">
                  <div className="list-headline">{s.asset} · {s.market}</div>
                  <div className="list-meta">
                    <span className={`action-badge ${s.action.toLowerCase()}`}>{s.action}</span>
                    <span>Conf {Math.round(s.confidence * 100)}%</span>
                    <span>{s.horizon}</span>
                  </div>
                  <div className="list-impact">{s.rationale}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
