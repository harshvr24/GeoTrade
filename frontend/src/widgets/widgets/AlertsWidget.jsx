import { useEffect, useState } from 'react'
import { apiV2 } from '../../api/v2'

export default function AlertsWidget() {
  const [alerts, setAlerts] = useState([])
  useEffect(() => {
    let alive = true
    apiV2.alerts().then(a => { if (alive) setAlerts(a) }).catch(() => {})
    const t = setInterval(() => apiV2.alerts().then(a => { if (alive) setAlerts(a) }).catch(() => {}), 20000)
    return () => { alive = false; clearInterval(t) }
  }, [])
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {alerts.map((al, idx) => (
        <div key={al.id || idx} style={{ padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)' }}>
          <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text)' }}>{al.type || 'alert'}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{al.message || 'No message'}</div>
        </div>
      ))}
      {alerts.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 12 }}>No alerts</div>}
    </div>
  )
}
