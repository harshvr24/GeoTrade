import { useState, useMemo } from 'react'
import { apiV2 } from '../api/v2'

const SEVERITY_COLOR = {
  critical: '#ff4444',
  high:     '#ff8c00',
  medium:   '#4488ff',
  low:      '#00e676',
}

const TIER_COLOR = {
  1: 'var(--green)',
  2: 'var(--cyan)',
  3: 'var(--blue)',
  4: 'var(--orange)',
}

const TIER_LABEL = {
  1: 'Tier 1',
  2: 'Tier 2',
  3: 'Tier 3',
  4: 'Tier 4',
}

export default function LiveFeedsView({ feeds }) {
  const [selectedRegion,  setSelectedRegion]  = useState('all')
  const [severityFilter, setSeverityFilter]  = useState('all')
  const [tierFilter,     setTierFilter]      = useState('all')

  // Enrich feeds with source tier and state-affiliated info
  const [sourceMeta, setSourceMeta] = useState({ tiers: {}, stateAffil: {} })

  // Fetch source metadata
  useMemo(() => {
    apiV2.sources().then(res => {
      const tiers = {}
      const stateAffil = {}
      ;(res.sources || []).forEach(s => {
        const key = s.id || s.url || s.name
        tiers[key] = s.tier
        if (s.state_affiliated) stateAffil[key] = s.state
      })
      setSourceMeta({ tiers, stateAffil })
    }).catch(() => {})
  }, [])

  const regions = useMemo(() => {
    const r = new Set(['all', ...feeds.map(f => f.region)])
    return Array.from(r)
  }, [feeds])

  const filtered = useMemo(() => {
    return feeds.filter(f => {
      const regionMatch  = selectedRegion  === 'all' || f.region === selectedRegion
      const severityMatch = severityFilter === 'all' || f.severity === severityFilter
      // Tier filter: look up by source name
      let tierMatch = tierFilter === 'all'
      if (!tierMatch && sourceMeta.tiers) {
        const key = Object.keys(sourceMeta.tiers).find(k =>
          f.source && (k.includes(f.source.toLowerCase()) || f.source.toLowerCase().includes(k))
        )
        const feedTier = key ? sourceMeta.tiers[key] : null
        tierMatch = feedTier === parseInt(tierFilter)
      }
      return regionMatch && severityMatch && tierMatch
    })
  }, [feeds, selectedRegion, severityFilter, tierFilter, sourceMeta])

  const getTierForFeed = (feed) => {
    if (!sourceMeta.tiers || !feed.source) return null
    const key = Object.keys(sourceMeta.tiers).find(k =>
      k.includes(feed.source.toLowerCase()) || feed.source.toLowerCase().includes(k)
    )
    return key ? sourceMeta.tiers[key] : null
  }

  const isStateAffiliated = (feed) => {
    if (!sourceMeta.stateAffil || !feed.source) return false
    const key = Object.keys(sourceMeta.stateAffil).find(k =>
      k.includes(feed.source.toLowerCase()) || feed.source.toLowerCase().includes(k)
    )
    return !!key
  }

  const formatTime = (timestamp) => {
    const ts = typeof timestamp === 'string' ? new Date(timestamp) : (timestamp instanceof Date ? timestamp : new Date())
    const now = new Date()
    const diff = now - ts
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div className="feeds-layout">
      {/* Left: Filter Sidebar */}
      <div className="feeds-sidebar">
        <div className="feeds-sidebar-title">Filters</div>

        <div className="filter-section">
          <div className="filter-label">Region</div>
          {regions.map(r => (
            <button
              key={r}
              className={`filter-option ${selectedRegion === r ? 'active' : ''}`}
              onClick={() => setSelectedRegion(r)}
            >
              <span className="filter-dot" />
              {r === 'all' ? 'All Regions' : r}
            </button>
          ))}
        </div>

        <div className="filter-divider" />

        <div className="filter-section">
          <div className="filter-label">Severity</div>
          {['all', 'critical', 'high', 'medium', 'low'].map(s => (
            <button
              key={s}
              className={`filter-option ${severityFilter === s ? 'active' : ''}`}
              onClick={() => setSeverityFilter(s)}
            >
              <span className="filter-dot" style={{ background: SEVERITY_COLOR[s] }} />
              {s === 'all' ? 'All Levels' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div className="filter-divider" />

        <div className="filter-section">
          <div className="filter-label">Source Tier</div>
          {['all', '1', '2', '3', '4'].map(t => (
            <button
              key={t}
              className={`filter-option ${tierFilter === t ? 'active' : ''}`}
              onClick={() => setTierFilter(t)}
            >
              {t === 'all'
                ? <><span className="filter-dot" style={{ background: 'var(--muted)' }} />All Tiers</>
                : <><span className="filter-dot" style={{ background: TIER_COLOR[t] || 'var(--muted)' }} />{TIER_LABEL[t]}</>
              }
            </button>
          ))}
        </div>

        <div style={{ marginTop: 'auto', fontSize: 10, color: 'var(--muted)', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Legend</div>
          <div>🔴 Critical: Immediate market impact</div>
          <div>🟠 High: Significant effects</div>
          <div>🔵 Medium: Moderate shifts</div>
          <div>🟢 Low: Limited influence</div>
          <div style={{ marginTop: 6 }}>
            <span style={{ color: 'var(--green)' }}>●</span> Tier 1: Premium (Reuters, AP, BBC)<br />
            <span style={{ color: 'var(--cyan)' }}>●</span> Tier 2: Standard (Bloomberg, FT)<br />
            <span style={{ color: 'var(--blue)' }}>●</span> Tier 3: Analytical (CSIS, Crisis Group)<br />
            <span style={{ color: 'var(--orange)' }}>●</span> Tier 4: State/investigative
          </div>
        </div>
      </div>

      {/* Right: Feeds Stream */}
      <div className="feeds-main">
        <div className="feeds-header">
          <div className="feeds-title">Live Geopolitical Events</div>
          <div className="feeds-subtitle">
            <span className="live-badge">
              <span className="live-dot" />
              LIVE
            </span>
            <span className="event-count">{filtered.length} events</span>
          </div>
        </div>

        <div className="feeds-stream">
          {filtered.length === 0 ? (
            <div className="feeds-empty">
              <div style={{ fontSize: 28, marginBottom: 10 }}>🔇</div>
              <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>No events match filters</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>Adjust filters to see more events</div>
            </div>
          ) : (
            filtered.map((feed, i) => {
              const tier = getTierForFeed(feed)
              const isState = isStateAffiliated(feed)
              const anomalyBadge = feed.anomaly_flag || feed.anomaly_zscore
              const focalBadge = feed.focal_point

              return (
                <div key={feed.id} className={`feed-item ${feed.severity === 'critical' ? 'feed-item--critical' : ''}`}>
                  <div className="feed-left">
                    <div className="feed-severity" style={{ background: SEVERITY_COLOR[feed.severity] }}>
                      <span style={{ fontSize: 10, fontWeight: 700 }}>
                        {feed.severity.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>

                  <div className="feed-center">
                    <div className="feed-headline">{feed.headline}</div>

                    <div className="feed-meta">
                      <span className="feed-region">{feed.region}</span>
                      <span className="feed-source">
                        {feed.source}
                        {/* State-affiliated warning tag */}
                        {isState && (
                          <span className="state-warning-tag" title={`State-affiliated: ${sourceMeta.stateAffil[Object.keys(sourceMeta.stateAffil).find(k => k.includes(feed.source?.toLowerCase() || '') || (feed.source?.toLowerCase() || '').includes(k))] || 'Unknown'}`}>
                            ⚠
                          </span>
                        )}
                      </span>
                      <span className="feed-impact">{feed.impact}</span>
                      {/* Source tier badge */}
                      {tier && (
                        <span
                          className="tier-badge"
                          style={{ background: TIER_COLOR[tier], color: tier <= 2 ? '#000' : '#fff', fontSize: 9 }}
                        >
                          T{tier}
                        </span>
                      )}
                      {/* Anomaly badge */}
                      {anomalyBadge && (
                        <span className="intel-badge intel-badge--anomaly" title="Anomaly detected in this region">
                          ⚡{typeof anomalyBadge === 'number' ? ` z=${anomalyBadge}` : ''}
                        </span>
                      )}
                      {/* Focal point badge */}
                      {focalBadge && (
                        <span className="intel-badge intel-badge--focal" title="Focal point entity">
                          ◉ focal
                        </span>
                      )}
                    </div>

                    <div className="feed-countries">
                      {feed.countries.map(c => (
                        <span key={c} className="feed-country-tag">{c}</span>
                      ))}
                    </div>
                  </div>

                  <div className="feed-right">
                    <div className="feed-time">{formatTime(feed.timestamp)}</div>
                    <div className={`feed-sentiment ${feed.sentiment < -0.3 ? 'neg' : feed.sentiment > 0.3 ? 'pos' : 'neu'}`}>
                      {feed.sentiment < 0 ? '📉' : feed.sentiment > 0 ? '📈' : '➡️'}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
