import { useState, useEffect } from 'react'
import { apiV2 } from '../../api/v2'

const SEVERITY_COLOR = {
  critical: 'var(--red)',
  high:     'var(--orange)',
  medium:   'var(--yellow)',
  low:      'var(--cyan)',
}

export default function AnomalyWidget() {
  const [anomalies, setAnomalies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const data = await apiV2.anomalies()
        if (!cancelled) {
          setAnomalies(data.anomalies || [])
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 60000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  if (loading) return <div className="widget-loading"><div className="skeleton-line" style={{ width: '80%' }} /><div className="skeleton-line" style={{ width: '60%' }} /></div>
  if (error) return <div className="widget-error">⚠ {error}</div>
  if (!anomalies.length) return <div className="widget-empty">No anomalies detected</div>

  return (
    <div className="anomaly-widget">
      <div className="anomaly-widget-header">
        <span className="anomaly-widget-title">⚡ Top Anomalies</span>
        <span className="anomaly-count">{anomalies.length}</span>
      </div>
      <div className="anomaly-list">
        {anomalies.slice(0, 3).map((a, i) => (
          <div key={i} className="anomaly-item">
            <div className="anomaly-item-header">
              <span
                className="anomaly-dot"
                style={{ background: SEVERITY_COLOR[a.severity] || 'var(--cyan)' }}
              />
              <span className="anomaly-region">{a.region}</span>
              <span className="anomaly-zscore">z={a.z_score}</span>
            </div>
            <div className="anomaly-item-message">{a.message}</div>
            <div className="anomaly-item-meta">
              {a.multiplier}x baseline · {a.event_type}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
