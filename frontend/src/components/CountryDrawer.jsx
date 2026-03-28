import React from 'react'
import CountryDrawerTabs from './CountryDrawerTabs'

export default function CountryDrawer({ detail, loading, onClose }) {
  if (!detail && !loading) return null

  const marketColor = (v) => v >= 0 ? '#22c55e' : '#ef4444'

  return (
    <div className="country-drawer">
      <div className="drawer-header">
        <div>
          <div className="drawer-label">Country Focus</div>
          {detail && (
            <div className="drawer-title">
              {detail.country.country_name}
              <span className="drawer-risk" data-level={detail.country.risk_level.toLowerCase()}>
                {detail.country.risk_level}
              </span>
            </div>
          )}
          {loading && <div className="drawer-sub">Loading latest news & markets…</div>}
          {detail && !loading && (
            <div className="drawer-sub">
              {detail.country.region} · Events: {detail.events.length} · Signals: {detail.signals.length}
            </div>
          )}
        </div>
        <button className="drawer-close" onClick={onClose}>×</button>
      </div>

      {loading && (
        <div className="drawer-loading">Fetching live data…</div>
      )}

      {detail && !loading && (
        <div className="drawer-grid">
          <CountryDrawerTabs detail={detail} />
        </div>
      )}
    </div>
  )
}
