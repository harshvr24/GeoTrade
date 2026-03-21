import { useEffect, useState } from 'react'
import GlobeView    from './components/GlobeView'
import GeoMapView   from './components/GeoMapView'
import AISignalsView from './components/AISignalsView'
import PortfolioView from './components/PortfolioView'
import LiveFeedsView from './components/LiveFeedsView'
import WaitlistModal from './components/WaitlistModal'
import { DEMO_DATA } from './data'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''
const VIEWS    = ['Earth Pulse', 'Geo Map', 'AI Signals', 'Portfolio', 'Live Feeds']

function useClock() {
  const [time, setTime] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return time
}

function fmtTime(d) {
  return d.toUTCString().slice(17, 25) + ' UTC'
}

function normalizeDashboard(api, prev = DEMO_DATA) {
  const base = prev ?? DEMO_DATA
  const toClock = (ts) => {
    if (!ts) return ''
    const dt = new Date(ts)
    return Number.isNaN(dt.getTime()) ? '' : dt.toISOString().slice(11, 16)
  }

  const countries = Array.isArray(api?.countries)
    ? api.countries.map(c => ({
        code: c.country_code,
        name: c.country_name,
        region: c.region,
        risk: c.risk_score,
        level: (c.risk_level || '').toLowerCase(),
      }))
    : base.countries

  const events = Array.isArray(api?.events)
    ? api.events.map(ev => ({
        id: ev.id,
        country: ev.country_name ?? ev.country_code,
        region: ev.region,
        headline: ev.headline,
        severity: ev.severity,
        time: ev.time ?? toClock(ev.timestamp),
        source: ev.source,
      }))
    : base.events

  return {
    ...base,
    gti: api?.gti ?? base.gti,
    gti_delta: api?.gti_delta ?? base.gti_delta,
    last_updated: api?.last_updated ?? base.last_updated,
    countries,
    events,
  }
}

export default function App() {
  const [activeView,   setActiveView]   = useState('Earth Pulse')
  const [showWaitlist, setShowWaitlist] = useState(false)
  const [data,         setData]         = useState(DEMO_DATA)
  const [usingDemo,    setUsingDemo]    = useState(true)
  const clock = useClock()

  // Try to load live data from API, fall back to demo
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/dashboard`)
        if (!res.ok) throw new Error()
        const json = await res.json()
        if (!alive) return
        setData(prev => normalizeDashboard(json, prev))
        setUsingDemo(false)
      } catch {
        // Keep demo data in dev without backend
      }
    }
    load()
    const t = setInterval(load, 30000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  const focusSignal = data.signals[0]

  return (
    <div className="app-shell">
      {/* ─── TOPBAR ──────────────────────────────── */}
      <header className="topbar">
        <div className="topbar-logo">
          <div className="logo-icon">G</div>
          <span className="logo-text">GEOTRADE</span>
        </div>

        <div className="topbar-gti">
          <div>
            <div className="gti-label">Global Tension Index (GTI)</div>
          </div>
          <span className="gti-value">{data.gti}</span>
          <span className="gti-delta">↑+{data.gti_delta}</span>
          <span className="elevated-badge">Elevated</span>
        </div>

        <nav className="topbar-nav">
          {VIEWS.map(v => (
            <button
              key={v}
              className={`nav-btn ${activeView === v ? 'active' : ''}`}
              onClick={() => setActiveView(v)}
            >
              <span className="nav-dot" />
              {v === 'Earth Pulse' ? '🌍 Earth Pulse' :
               v === 'Geo Map'     ? '🗺 Geo Map' :
               v === 'AI Signals'  ? '✦ AI Signals' :
               v === 'Portfolio'   ? '💼 Portfolio' :
                                     '📰 Live Feeds'}
            </button>
          ))}
        </nav>

        <div className="topbar-right">
          <div className="live-badge">
            <span className="live-dot" />
            LIVE
          </div>
          <div className="timeframe-toggle">
            <button className="tf-btn active">1MIN</button>
            <button className="tf-btn">5MIN</button>
          </div>
          <div className="time-pill mono">{fmtTime(clock)}</div>
          {usingDemo && (
            <span style={{ fontSize: 10, color: 'var(--muted)', padding: '2px 6px', background: 'var(--bg3)', borderRadius: 3, border: '1px solid var(--border)' }}>
              Demo
            </span>
          )}
        </div>
      </header>

      {/* ─── MAIN CONTENT ────────────────────────── */}
      <div className="main-content">
        {activeView === 'Earth Pulse' && (
          <GlobeView
            countries={data.countries}
            signals={data.signals}
            focusSignal={focusSignal}
            onCountryClick={() => {}}
          />
        )}
        {activeView === 'Geo Map' && (
          <GeoMapView
            countries={data.countries}
            chartData={data.chartData}
          />
        )}
        {activeView === 'AI Signals' && (
          <AISignalsView signals={data.signals} />
        )}
        {activeView === 'Portfolio' && (
          <PortfolioView portfolio={data.portfolio} />
        )}
        {activeView === 'Live Feeds' && (
          <LiveFeedsView feeds={data.feeds} />
        )}
      </div>

      {/* ─── BOTTOM BAR ──────────────────────────── */}
      <footer className="bottom-bar">
        <div className="bottom-gti-section">
          <span className="bottom-gti-label">GTI Trend</span>
          <span className="bottom-gti-val mono" style={{ color: 'var(--red)' }}>
            {data.gti}
          </span>
          <div className="sparkline">
            {data.sparkValues.map((v, i) => (
              <div
                key={i}
                className="spark-bar"
                style={{ height: `${(v / 80) * 18}px` }}
              />
            ))}
          </div>
        </div>

        <div className="bottom-events">
          {data.events.map(ev => (
            <div key={ev.id} className="event-pill">
              <span className={`sev-dot ${ev.severity}`} />
              <span style={{ color: 'var(--muted)', fontSize: 10 }}>{ev.time}</span>
              <span style={{ fontSize: 11 }}>{ev.headline}</span>
              <span style={{ color: 'var(--muted)', fontSize: 10 }}>· {ev.region}</span>
            </div>
          ))}
        </div>

        <div className="bottom-right">
          <button className="join-waitlist-btn" onClick={() => setShowWaitlist(true)}>
            ✦ Join Waitlist
          </button>
        </div>
      </footer>

      {/* ─── WAITLIST MODAL ──────────────────────── */}
      {showWaitlist && (
        <WaitlistModal onClose={() => setShowWaitlist(false)} />
      )}
    </div>
  )
}
