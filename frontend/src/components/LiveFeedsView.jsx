import { useState, useMemo } from 'react'

export default function LiveFeedsView({ feeds }) {
  const [selectedRegion, setSelectedRegion] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')

  const regions = useMemo(() => {
    const r = new Set(['all', ...feeds.map(f => f.region)])
    return Array.from(r)
  }, [feeds])

  const filtered = useMemo(() => {
    return feeds.filter(f => {
      const regionMatch = selectedRegion === 'all' || f.region === selectedRegion
      const severityMatch = severityFilter === 'all' || f.severity === severityFilter
      return regionMatch && severityMatch
    })
  }, [feeds, selectedRegion, severityFilter])

  const severityColor = {
    critical: '#ff4444',
    high: '#ff8c00',
    medium: '#4488ff',
    low: '#00e676',
  }

  const formatTime = (timestamp) => {
    const now = new Date()
    const diff = now - timestamp
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
              <span className="filter-dot" style={{ background: severityColor[s] }} />
              {s === 'all' ? 'All Levels' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 'auto', fontSize: 10, color: 'var(--muted)', lineHeight: 1.6 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Legend</div>
          <div>🔴 Critical: Immediate market impact</div>
          <div>🟠 High: Significant effects</div>
          <div>🔵 Medium: Moderate shifts</div>
          <div>🟢 Low: Limited influence</div>
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
            filtered.map((feed, i) => (
              <div key={feed.id} className="feed-item">
                <div className="feed-left">
                  <div className="feed-severity" style={{ background: severityColor[feed.severity] }}>
                    <span style={{ fontSize: 10, fontWeight: 700 }}>
                      {feed.severity.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="feed-center">
                  <div className="feed-headline">{feed.headline}</div>
                  
                  <div className="feed-meta">
                    <span className="feed-region">{feed.region}</span>
                    <span className="feed-source">{feed.source}</span>
                    <span className="feed-impact">{feed.impact}</span>
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
            ))
          )}
        </div>
      </div>
    </div>
  )
}
