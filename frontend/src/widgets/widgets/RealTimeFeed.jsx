import { useEffect, useState } from 'react'
import { apiV2 } from '../../api/v2'

export default function RealTimeFeed() {
  const [events, setEvents] = useState([])
  useEffect(() => {
    let alive = true
    apiV2.events('limit=20').then(set => { if (alive) setEvents(set) }).catch(() => {})
    const t = setInterval(() => apiV2.events('limit=20').then(set => { if (alive) setEvents(set) }).catch(() => {}), 30000)
    return () => { alive = false; clearInterval(t) }
  }, [])
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {events.map(ev => (
        <div key={ev.id} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)' }}>
          <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 12 }}>{ev.headline}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{ev.region} · {ev.severity}</div>
        </div>
      ))}
      {events.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 12 }}>No events</div>}
    </div>
  )
}
