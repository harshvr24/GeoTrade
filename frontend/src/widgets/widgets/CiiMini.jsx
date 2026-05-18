import { useEffect, useState } from 'react'
import { apiV2 } from '../../api/v2'

export default function CiiMini() {
  const [cii, setCii] = useState(null)
  useEffect(() => {
    let alive = true
    apiV2.cii().then(set => { if (alive) setCii(set) }).catch(() => {})
    return () => { alive = false }
  }, [])
  if (!cii) return <div style={{ color: 'var(--muted)', fontSize: 12 }}>No data</div>
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {cii.top.map(item => (
        <div key={item.code} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
          <span style={{ color: 'var(--text)' }}>{item.code}</span>
          <span style={{ color: 'var(--cyan)' }}>{item.score}</span>
        </div>
      ))}
    </div>
  )
}
