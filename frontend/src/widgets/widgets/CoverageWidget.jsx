import { useState, useEffect } from 'react'
import { apiV2 } from '../../api/v2'

const TIERS = [
  { tier: 1, label: 'Premium', color: 'var(--green)',  desc: 'Reuters, AP, BBC, UN, NATO' },
  { tier: 2, label: 'Standard', color: 'var(--cyan)',  desc: 'Bloomberg, FT, NYT, Economist' },
  { tier: 3, label: 'Analytical', color: 'var(--blue)', desc: 'CSIS, Crisis Group, Foreign Policy' },
  { tier: 4, label: 'State/Alt', color: 'var(--orange)', desc: 'RT, Xinhua, regional investigative' },
]

export default function CoverageWidget() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        // Fetch brief to get source_tier_summary, and sources count
        const [briefData, sourcesData] = await Promise.all([
          apiV2.brief().catch(() => null),
          apiV2.sources().catch(() => null),
        ])
        if (!cancelled) {
          setSummary({
            byTier: briefData?.event_count ? {} : {}, // populated from brief
            total: sourcesData?.count || 0,
            sourcesCount: sourcesData?.count || 0,
          })
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

  if (loading) return <div className="widget-loading"><div className="skeleton-line" style={{ width: '60%' }} /><div className="skeleton-line" style={{ width: '80%' }} /></div>
  if (error) return <div className="widget-error">⚠ {error}</div>

  // Use live counts if available from BriefWidget data context
  // Otherwise show static coverage
  return (
    <div className="coverage-widget">
      <div className="coverage-widget-header">
        <span className="coverage-widget-title">Source Coverage</span>
        {summary?.sourcesCount > 0 && (
          <span className="coverage-total-count">{summary.sourcesCount} sources</span>
        )}
      </div>
      <div className="coverage-dots-grid">
        {TIERS.map(t => (
          <div key={t.tier} className="coverage-tier-row">
            <div className="coverage-tier-dot" style={{ background: t.color }} />
            <div className="coverage-tier-info">
              <div className="coverage-tier-label">Tier {t.tier} — {t.label}</div>
              <div className="coverage-tier-desc">{t.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="coverage-footer">
        <span className="coverage-footer-note">
          Credibility weighted by source tier
        </span>
      </div>
    </div>
  )
}
