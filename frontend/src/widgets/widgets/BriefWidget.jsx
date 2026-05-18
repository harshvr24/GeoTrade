import { useState, useEffect } from 'react'
import { apiV2 } from '../../api/v2'

export default function BriefWidget() {
  const [brief, setBrief] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const data = await apiV2.brief()
        if (!cancelled) {
          setBrief(data)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) return <div className="widget-loading"><div className="skeleton-line" style={{ width: '80%' }} /><div className="skeleton-line" style={{ width: '60%' }} /><div className="skeleton-line" style={{ width: '70%' }} /></div>
  if (error) return <div className="widget-error">⚠ {error}</div>
  if (!brief) return <div className="widget-empty">No brief available</div>

  return (
    <div className="brief-widget">
      <div className="brief-widget-header">
        <span className="brief-widget-label">World Brief</span>
        <span className={`brief-source-badge ${brief.source === 'llm' ? 'llm' : 'heuristic'}`}>
          {brief.source === 'llm' ? 'AI' : 'Heuristic'}
        </span>
      </div>
      <div className="brief-widget-body">
        <p className="brief-widget-text">
          {brief.sections?.critical || brief.brief}
        </p>
      </div>
      <div className="brief-widget-footer">
        <span className="brief-widget-time">
          {new Date(brief.generated_at).toLocaleTimeString()} · {brief.event_count} events
        </span>
        <span className="brief-widget-watchpoints">
          {brief.sections?.watchpoints?.slice(0, 60)}...
        </span>
      </div>
    </div>
  )
}
