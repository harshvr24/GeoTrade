import { useEffect, useState } from 'react'
import { apiV2 } from '../../api/v2'

export default function MarketsMini() {
  const [quotes, setQuotes] = useState({})
  useEffect(() => {
    let alive = true
    apiV2.markets().then(data => { if (alive) setQuotes(data.quotes || {}) }).catch(() => {})
    const t = setInterval(() => apiV2.markets().then(data => { if (alive) setQuotes(data.quotes || {}) }).catch(() => {}), 45000)
    return () => { alive = false; clearInterval(t) }
  }, [])
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {Object.values(quotes).map(q => (
        <div key={q.symbol} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: 'var(--text)', fontWeight: 700 }}>{q.symbol}</span>
          <span style={{ color: q.change_pct >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {q.price} ({q.change_pct >=0 ? '+' : ''}{q.change_pct}%)
          </span>
        </div>
      ))}
      {Object.keys(quotes).length === 0 && <div style={{ color: 'var(--muted)', fontSize: 12 }}>No quotes</div>}
    </div>
  )
}
