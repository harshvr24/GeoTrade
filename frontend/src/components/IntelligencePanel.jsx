import { useState, useEffect, useCallback } from 'react'
import { apiV2 } from '../api/v2'

// ─── Sub-components ───────────────────────────────────────────────────────────

function BriefCard({ brief, loading, error }) {
  if (loading) return <LoadingSkeleton lines={5} />
  if (error) return <ErrorState message={error} onRetry={() => brief()} />
  if (!brief) return <EmptyState message="World brief unavailable" />

  return (
    <div className="intel-card intel-card--brief">
      <div className="intel-card-header">
        <span className="intel-card-title">World Brief</span>
        <span className={`intel-source-badge ${brief.source === 'llm' ? 'llm' : 'heuristic'}`}>
          {brief.source === 'llm' ? 'AI' : 'Heuristic'}
          {brief.cached ? ' · cached' : ''}
        </span>
      </div>
      <div className="intel-brief-meta">
        Generated {new Date(brief.generated_at).toLocaleTimeString()} · {brief.event_count} events analyzed
      </div>
      <div className="intel-brief-section">
        <div className="intel-brief-label">Critical Developments</div>
        <p className="intel-brief-text">{brief.sections?.critical || brief.brief}</p>
      </div>
      <div className="intel-brief-section">
        <div className="intel-brief-label">Market Implications</div>
        <p className="intel-brief-text">{brief.sections?.markets}</p>
      </div>
      <div className="intel-brief-section">
        <div className="intel-brief-label">48h Watchpoints</div>
        <p className="intel-brief-text">{brief.sections?.watchpoints}</p>
      </div>
    </div>
  )
}

function FocalPointsCard({ focalPoints, loading, error }) {
  if (loading) return <LoadingSkeleton lines={4} />
  if (error) return <ErrorState message={error} onRetry={() => focalPoints()} />
  if (!focalPoints?.length) return <EmptyState message="No focal points detected" />

  return (
    <div className="intel-card">
      <div className="intel-card-header">
        <span className="intel-card-title">Focal Points</span>
        <span className="intel-count-badge">{focalPoints.length}</span>
      </div>
      <div className="intel-list">
        {focalPoints.map((fp, i) => (
          <div key={i} className="intel-list-item intel-list-item--focal">
            <div className="focal-header">
              <span className="focal-entity">{fp.entity}</span>
              <span className={`focal-urgency ${fp.urgency_score >= 70 ? 'high' : fp.urgency_score >= 40 ? 'medium' : 'low'}`}>
                {Math.round(fp.urgency_score)}
              </span>
            </div>
            <div className="focal-signals">
              {fp.signal_types.map(t => (
                <span key={t} className="signal-type-tag">{t}</span>
              ))}
            </div>
            {fp.events?.length > 0 && (
              <div className="focal-top-event">
                {fp.events[0].headline}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function AnomaliesCard({ anomalies, loading, error }) {
  if (loading) return <LoadingSkeleton lines={4} />
  if (error) return <ErrorState message={error} onRetry={() => anomalies()} />
  if (!anomalies?.length) return <EmptyState message="No anomalies detected" />

  const severityColor = { critical: 'var(--red)', high: 'var(--orange)', medium: 'var(--yellow)', low: 'var(--cyan)' }

  return (
    <div className="intel-card">
      <div className="intel-card-header">
        <span className="intel-card-title">Anomalies</span>
        <span className="intel-count-badge">{anomalies.length}</span>
      </div>
      <div className="intel-list">
        {anomalies.slice(0, 8).map((a, i) => (
          <div key={i} className="intel-list-item intel-list-item--anomaly">
            <div className="anomaly-header">
              <span
                className="anomaly-severity-dot"
                style={{ background: severityColor[a.severity] || 'var(--cyan)' }}
              />
              <span className="anomaly-region">{a.region}</span>
              <span className="anomaly-zscore">z={a.z_score}</span>
            </div>
            <div className="anomaly-message">{a.message}</div>
            <div className="anomaly-meta">
              {a.event_type} · {a.multiplier}x baseline · {new Date(a.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function GapsCard({ gaps, loading, error }) {
  if (loading) return <LoadingSkeleton lines={4} />
  if (error) return <ErrorState message={error} onRetry={() => gaps()} />
  if (!gaps?.length) return <EmptyState message="No intelligence gaps detected" />

  return (
    <div className="intel-card">
      <div className="intel-card-header">
        <span className="intel-card-title">Intelligence Gaps</span>
        <span className="intel-count-badge gap">{gaps.length}</span>
      </div>
      <div className="intel-gap-explanation">
        High structural risk with low news coverage — areas that may be under-reported.
      </div>
      <div className="intel-list">
        {gaps.slice(0, 8).map((g, i) => (
          <div key={i} className="intel-list-item intel-list-item--gap">
            <div className="gap-header">
              <span className="gap-country">{g.country_code}</span>
              <span className={`gap-severity ${g.gap_severity}`}>{g.gap_severity}</span>
              <span className="gap-cii">CII {g.cii_score}</span>
            </div>
            <div className="gap-reason">{g.reason}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Shared UI primitives ───────────────────────────────────────────────────

function LoadingSkeleton({ lines = 3 }) {
  return (
    <div className="intel-skeleton">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton-line" style={{ width: `${70 + Math.random() * 30}%` }} />
      ))}
    </div>
  )
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="intel-error">
      <span className="intel-error-icon">⚠</span>
      <span className="intel-error-msg">{message || 'Failed to load'}</span>
      <button className="intel-retry-btn" onClick={onRetry}>Retry</button>
    </div>
  )
}

function EmptyState({ message }) {
  return (
    <div className="intel-empty">
      <span className="intel-empty-icon">◎</span>
      <span className="intel-empty-msg">{message}</span>
    </div>
  )
}

// ─── Main IntelligencePanel ──────────────────────────────────────────────────

export default function IntelligencePanel() {
  const [brief, setBrief] = useState(null)
  const [focalPoints, setFocalPoints] = useState(null)
  const [anomalies, setAnomalies] = useState(null)
  const [gaps, setGaps] = useState(null)
  const [loading, setLoading] = useState({ brief: true, focal: true, anomalies: true, gaps: true })
  const [errors, setErrors] = useState({})

  const fetchBrief = useCallback(async () => {
    setLoading(l => ({ ...l, brief: true }))
    try {
      const data = await apiV2.brief()
      setBrief(data)
      setErrors(e => ({ ...e, brief: null }))
    } catch (err) {
      setErrors(e => ({ ...e, brief: err.message }))
    } finally {
      setLoading(l => ({ ...l, brief: false }))
    }
  }, [])

  const fetchFocalPoints = useCallback(async () => {
    setLoading(l => ({ ...l, focal: true }))
    try {
      const data = await apiV2.focalPoints()
      setFocalPoints(data.focal_points || [])
      setErrors(e => ({ ...e, focal: null }))
    } catch (err) {
      setErrors(e => ({ ...e, focal: err.message }))
    } finally {
      setLoading(l => ({ ...l, focal: false }))
    }
  }, [])

  const fetchAnomalies = useCallback(async () => {
    setLoading(l => ({ ...l, anomalies: true }))
    try {
      const data = await apiV2.anomalies()
      setAnomalies(data.anomalies || [])
      setErrors(e => ({ ...e, anomalies: null }))
    } catch (err) {
      setErrors(e => ({ ...e, anomalies: err.message }))
    } finally {
      setLoading(l => ({ ...l, anomalies: false }))
    }
  }, [])

  const fetchGaps = useCallback(async () => {
    setLoading(l => ({ ...l, gaps: true }))
    try {
      const data = await apiV2.gaps()
      setGaps(data.gaps || [])
      setErrors(e => ({ ...e, gaps: null }))
    } catch (err) {
      setErrors(e => ({ ...e, gaps: err.message }))
    } finally {
      setLoading(l => ({ ...l, gaps: false }))
    }
  }, [])

  useEffect(() => {
    fetchBrief()
    fetchFocalPoints()
    fetchAnomalies()
    fetchGaps()
  }, [fetchBrief, fetchFocalPoints, fetchAnomalies, fetchGaps])

  const isAnyLoading = Object.values(loading).some(Boolean)
  const errorCount = Object.values(errors).filter(Boolean).length

  return (
    <div className="intelligence-layout">
      {/* Header */}
      <div className="intel-header">
        <div className="intel-header-title">
          <span className="intel-header-icon">✦</span>
          Intelligence Overview
        </div>
        <div className="intel-header-meta">
          {errorCount === 0 && !isAnyLoading && (
            <span className="intel-live-badge">● Live</span>
          )}
          {errorCount > 0 && !isAnyLoading && (
            <span className="intel-partial-badge">⚠ {errorCount} feed(s) failed</span>
          )}
          {isAnyLoading && <span className="intel-loading-badge">Loading...</span>}
        </div>
      </div>

      {/* 4-card grid */}
      <div className="intel-grid">
        <div className="intel-grid-item intel-grid-item--wide">
          <BriefCard
            brief={brief}
            loading={loading.brief}
            error={errors.brief}
          />
        </div>
        <div className="intel-grid-item">
          <FocalPointsCard
            focalPoints={focalPoints}
            loading={loading.focal}
            error={errors.focal}
          />
        </div>
        <div className="intel-grid-item">
          <AnomaliesCard
            anomalies={anomalies}
            loading={loading.anomalies}
            error={errors.anomalies}
          />
        </div>
        <div className="intel-grid-item">
          <GapsCard
            gaps={gaps}
            loading={loading.gaps}
            error={errors.gaps}
          />
        </div>
      </div>
    </div>
  )
}
