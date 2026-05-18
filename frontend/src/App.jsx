import { useEffect, useState } from 'react'
import GlobeView       from './components/GlobeView'
import GeoMapView      from './components/GeoMapView'
import AISignalsView  from './components/AISignalsView'
import IntelligencePanel from './components/IntelligencePanel'
import PortfolioView  from './components/PortfolioView'
import LiveFeedsView  from './components/LiveFeedsView'
import WaitlistModal  from './components/WaitlistModal'
import CountryDrawer  from './components/CountryDrawer'
import TradingSignalsPanel from './components/TradingSignalsPanel'
import GeopoliticalIndexPanel from './components/GeopoliticalIndexPanel'
import MarketImpactPanel from './components/MarketImpactPanel'
import WidgetBoard from './widgets/WidgetBoard'
import { DEMO_DATA } from './data'

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const WS_URL   = import.meta.env.VITE_WS_URL
  || (API_BASE ? API_BASE.replace(/^http/i, 'ws') + '/ws/stream'
               : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/stream`)
const WS_V2_URL = import.meta.env.VITE_WS_V2_URL
  || (API_BASE ? API_BASE.replace(/^http/i, 'ws') + '/ws/stream/v2'
               : `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/stream/v2`)

const VIEWS    = ['Earth Pulse', 'Geo Map', 'AI Signals', 'Intelligence', 'Trading Signals', 'Geo Risk Index', 'Market Impact', 'Portfolio', 'Live Feeds', 'Widgets']

const computeSummary = (signals = []) => {
  const total = signals.length
  const buy = signals.filter(s => s.action === 'BUY').length
  const sell = signals.filter(s => s.action === 'SELL').length
  const avgConfidence = total ? +(signals.reduce((a, s) => a + (s.confidence || 0), 0) / total).toFixed(2) : 0
  return { total, buy, sell, avgConfidence }
}

const normalizeSignals = (apiSignals = [], prev = []) => {
  if (!Array.isArray(apiSignals) || apiSignals.length === 0) return prev

  return apiSignals.map((s, idx) => {
    const entryNum = Number(s.entry) || Number(s.price) || 0
    const confidence = s.confidence ?? 0.5
    const bull = s.bull_strength ?? Math.round(confidence * 100 * (s.action === 'SELL' ? 0.6 : 0.8))
    const bear = s.bear_strength ?? Math.max(10, 100 - bull)
    return {
      id: s.id || `sig-${idx}`,
      asset: s.asset,
      category: `${s.market || 'Global'} signal`,
      action: s.action,
      price: entryNum,
      change: parseFloat((s.move || '').replace('%', '')) || 0,
      changeP: s.move || '',
      confidence,
      bullStrength: bull,
      bearStrength: bear,
      volatility: s.volatility || 'MEDIUM',
      timeframes: s.timeframes || [s.horizon || '24-72h'],
      rationale: s.rationale || s.trigger || '',
      trigger: s.trigger || s.rationale || '',
      triggerSub: s.trigger_sub || s.triggerSub || s.horizon || '',
      entry: entryNum || 0,
      stopLoss: entryNum ? +(entryNum * 0.985).toFixed(2) : 0,
      target: entryNum ? +(entryNum * 1.02).toFixed(2) : 0,
      rr: s.rr || '1.8x',
      winRate: s.win_rate || `${Math.round(confidence * 100)}%`,
      riskMod: s.risk_mod || `${Math.round((s.market_impact || 1) * 100) / 100}%`,
      riskAmount: s.risk_amount ?? (entryNum ? +(entryNum * 0.02).toFixed(3) : 0),
      rewardAmount: s.reward_amount ?? (entryNum ? +(entryNum * 0.04).toFixed(3) : 0),
      riskFlags: s.risk_flags || s.riskFlags || [],
      // Intelligence metadata
      source_tier: s.source_tier ?? null,
      state_affiliated: s.state_affiliated ?? false,
      anomaly_flag: s.anomaly_flag ?? false,
      focal_point: s.focal_point ?? false,
      cii_score: s.cii_score ?? null,
      cii_level: s.cii_level ?? null,
    }
  })
}

const normalizeFeeds = (apiFeeds = [], prev = []) => {
  if (!Array.isArray(apiFeeds) || apiFeeds.length === 0) return prev
  return apiFeeds.map((f, idx) => ({
    id: f.id || `feed-${idx}`,
    time: f.time || '',
    timestamp: f.timestamp ? new Date(f.timestamp) : new Date(),
    headline: f.headline,
    region: f.region || 'Global',
    severity: (f.severity || 'medium').toLowerCase(),
    source: f.source || 'GeoTrade',
    impact: f.impact || '',
    countries: f.countries || [],
    sentiment: typeof f.sentiment === 'number' ? f.sentiment : 0,
  }))
}

const eventsToFeeds = (events = []) =>
  events.map((ev, idx) => ({
    id: ev.id || `ev-${idx}`,
    time: ev.time || '',
    timestamp: ev.timestamp || ev.last_updated || new Date().toISOString(),
    headline: ev.headline,
    region: ev.region || 'Global',
    severity: (ev.severity || 'medium').toLowerCase(),
    source: ev.source || 'GeoTrade',
    impact: ev.market_impact ? `${ev.market_impact}% impact` : '',
    countries: [ev.country_code, ev.related_country_code].filter(Boolean),
    sentiment: ev.sentiment ?? 0,
  }))

const normalizePortfolio = (apiPortfolio, prev = DEMO_DATA.portfolio) => {
  if (!apiPortfolio) return prev
  const p = apiPortfolio
  return {
    totalValue: p.total_value ?? prev.totalValue,
    totalPnL: p.total_pnl ?? prev.totalPnL,
    totalPnLPct: p.total_pnl_pct ?? prev.totalPnLPct,
    positions: (p.positions || []).map(pos => ({
      id: pos.id,
      asset: pos.asset,
      size: pos.size,
      entryPrice: pos.entry_price,
      currentPrice: pos.current_price,
      pnl: pos.pnl,
      pnlPct: pos.pnl_pct,
      riskRatio: pos.risk_ratio,
      timeOpen: pos.time_open,
      signal: pos.signal,
      status: pos.status,
    })),
    metrics: {
      winRate: p.metrics?.win_rate ?? prev.metrics.winRate,
      sharpeRatio: p.metrics?.sharpe_ratio ?? prev.metrics.sharpeRatio,
      maxDrawdown: p.metrics?.max_drawdown ?? prev.metrics.maxDrawdown,
      avgWin: p.metrics?.avg_win ?? prev.metrics.avgWin,
      avgLoss: p.metrics?.avg_loss ?? prev.metrics.avgLoss,
    },
  }
}

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

  const signals = normalizeSignals(api?.signals, base.signals)
  const signalSummary = api?.signal_summary
    ? {
        total: api.signal_summary.total ?? api.signal_summary.total_signals ?? signals.length,
        buy: api.signal_summary.buy ?? api.signal_summary.buy_signals ?? 0,
        sell: api.signal_summary.sell ?? api.signal_summary.sell_signals ?? 0,
        avgConfidence: api.signal_summary.avg_confidence ?? api.signal_summary.average_confidence ?? 0,
      }
    : computeSummary(signals)

  return {
    ...base,
    gti: api?.gti ?? base.gti,
    gti_delta: api?.gti_delta ?? base.gti_delta,
    last_updated: api?.last_updated ?? base.last_updated,
    countries,
    events,
    signals,
    signalSummary,
  }
}

export default function App() {
  const [activeView,   setActiveView]   = useState('Earth Pulse')
  const [showWaitlist, setShowWaitlist] = useState(false)
  const [data,         setData]         = useState({ ...DEMO_DATA, signalSummary: computeSummary(DEMO_DATA.signals) })
  const [usingDemo,    setUsingDemo]    = useState(true)
  const [countryCode,  setCountryCode]  = useState(null)
  const [countryDetail,setCountryDetail]= useState(null)
  const [countryLoading,setCountryLoading] = useState(false)
  const [liveStatus, setLiveStatus] = useState('idle')

  // Intelligence state from WebSocket v2
  const [intelligence, setIntelligence] = useState({
    cii_scores: [],
    anomalies: [],
    focal_points: [],
    convergence_alerts: [],
    source_tier_summary: {},
  })
  const [intelStatus, setIntelStatus] = useState('idle')

  const clock = useClock()

  // Try to load live data from API, fall back to demo
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const [dashRes, feedsRes, portfolioRes] = await Promise.all([
          fetch(`${API_BASE}/api/dashboard`).then(r => r.ok ? r.json() : null),
          fetch(`${API_BASE}/api/feeds`).then(r => r.ok ? r.json() : null),
          fetch(`${API_BASE}/api/portfolio`).then(r => r.ok ? r.json() : null),
        ])
        if (!alive) return
        setData(prev => {
          const normalized = normalizeDashboard(dashRes, prev)
          normalized.feeds = normalizeFeeds(feedsRes?.feeds, normalized.feeds ?? prev.feeds)
          normalized.portfolio = normalizePortfolio(portfolioRes?.portfolio, normalized.portfolio ?? prev.portfolio)
          normalized.signalSummary = normalized.signalSummary ?? computeSummary(normalized.signals)
          return normalized
        })
        setUsingDemo(false)
      } catch {
        // Keep demo data in dev without backend
      }
    }
    load()
    const t = setInterval(load, 30000)
    return () => { alive = false; clearInterval(t) }
  }, [])

  // Live updates via WebSocket v1
  useEffect(() => {
    let ws
    let retry

    const connect = () => {
      ws = new WebSocket(WS_URL)
      ws.onopen = () => setLiveStatus('live')
      ws.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data)
          if (payload?.type === 'snapshot' && payload.data) {
            setData(prev => {
              const normalized = normalizeDashboard(payload.data, prev)
              const derivedFeeds = payload.data.events ? normalizeFeeds(eventsToFeeds(payload.data.events), normalized.feeds ?? prev.feeds) : (normalized.feeds ?? prev.feeds)
              normalized.feeds = derivedFeeds
              normalized.signalSummary = normalized.signalSummary ?? computeSummary(normalized.signals)
              return normalized
            })
          }
        } catch {
          /* ignore malformed packets */
        }
      }
      ws.onclose = () => {
        setLiveStatus('retry')
        retry = setTimeout(connect, 4000)
      }
      ws.onerror = () => ws.close()
    }

    connect()
    return () => {
      if (ws) ws.close()
      if (retry) clearTimeout(retry)
    }
  }, [])

  // Intelligence updates via WebSocket v2
  useEffect(() => {
    let ws
    let retry

    const connect = () => {
      ws = new WebSocket(WS_V2_URL)
      ws.onopen = () => setIntelStatus('live')
      ws.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data)
          if (payload?.type === 'snapshot_v2' && payload.data) {
            const d = payload.data
            setIntelligence(prev => ({
              cii_scores: d.cii_scores || prev.cii_scores || [],
              anomalies: d.anomalies || prev.anomalies || [],
              focal_points: d.focal_points || prev.focal_points || [],
              convergence_alerts: d.convergence_alerts || prev.convergence_alerts || [],
              source_tier_summary: d.source_tier_summary || prev.source_tier_summary || {},
            }))
          }
        } catch {
          /* ignore malformed packets */
        }
      }
      ws.onclose = () => {
        setIntelStatus('intel_retry')
        retry = setTimeout(connect, 6000)
      }
      ws.onerror = () => ws.close()
    }

    connect()
    return () => {
      if (ws) ws.close()
      if (retry) clearTimeout(retry)
    }
  }, [])

  const fetchCountry = async (code) => {
    if (!code) return
    setCountryLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/country/${code}`)
      if (!res.ok) throw new Error()
      const json = await res.json()
      setCountryDetail(json)
    } catch {
      setCountryDetail(null)
    } finally {
      setCountryLoading(false)
    }
  }

  const focusSignal = data.signals[0] || {}
  const signalSummary = data.signalSummary || computeSummary(data.signals)

  // Source coverage dots from intelligence
  const coverageDots = (() => {
    const summary = intelligence.source_tier_summary || {}
    const byTier = summary.by_tier || {}
    return [
      { tier: 1, count: byTier[1] || 0, color: 'var(--green)',   label: 'Premium' },
      { tier: 2, count: byTier[2] || 0, color: 'var(--cyan)',    label: 'Standard' },
      { tier: 3, count: byTier[3] || 0, color: 'var(--blue)',    label: 'Analytical' },
      { tier: 4, count: byTier[4] || 0, color: 'var(--orange)',  label: 'State' },
    ]
  })()

  const anomalyCount = intelligence.anomalies?.length || 0
  const focalCount = intelligence.focal_points?.length || 0

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

        <div className="topbar-signals">
          <div className="gti-label">Signals</div>
          <div className="signal-meter">
            <span className="signal-total">{signalSummary.total}</span>
            <div className="signal-bar-wrap">
              <div className="signal-bar buy" style={{ width: `${Math.min(100, (signalSummary.buy / Math.max(signalSummary.total || 1, 1)) * 100)}%` }} />
              <div className="signal-bar sell" style={{ width: `${Math.min(100, (signalSummary.sell / Math.max(signalSummary.total || 1, 1)) * 100)}%` }} />
            </div>
            <span className="signal-conf">{Math.round((signalSummary.avgConfidence || 0) * 100)}% avg</span>
          </div>
        </div>

        {/* Intelligence counter */}
        {(anomalyCount > 0 || focalCount > 0) && (
          <div className="topbar-intel-counter">
            <div className="gti-label">Intelligence</div>
            <div className="intel-counter-pills">
              {anomalyCount > 0 && (
                <span className="intel-pill intel-pill--anomaly" title={`${anomalyCount} active anomalies`}>
                  ⚡ {anomalyCount}
                </span>
              )}
              {focalCount > 0 && (
                <span className="intel-pill intel-pill--focal" title={`${focalCount} focal points`}>
                  ◉ {focalCount}
                </span>
              )}
            </div>
          </div>
        )}

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
               v === 'Intelligence' ? '◈ Intelligence' :
               v === 'Trading Signals' ? '📈 Trading Signals' :
               v === 'Geo Risk Index' ? '⚠ Geo Risk Index' :
               v === 'Market Impact' ? '💥 Market Impact' :
               v === 'Portfolio'   ? '💼 Portfolio' :
                                     '📰 Live Feeds'}
            </button>
          ))}
        </nav>

        <div className="topbar-right">
          <div className={`live-badge ${liveStatus === 'live' ? 'live' : 'muted'}`}>
            <span className="live-dot" />
            {liveStatus === 'live' ? 'LIVE' : 'SYNC'}
          </div>
          {/* Source coverage dots */}
          <div className="coverage-dots" title={coverageDots.map(d => `${d.label}: ${d.count}`).join(' | ')}>
            {coverageDots.map(d => (
              <span
                key={d.tier}
                className="coverage-dot"
                style={{ background: d.count > 0 ? d.color : 'var(--muted2)' }}
                title={`${d.label}: ${d.count}`}
              />
            ))}
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
            onCountryClick={(c) => {
              const code = c.country_code || c.code
              setCountryCode(code)
              fetchCountry(code)
            }}
          />
        )}
        {activeView === 'Geo Map' && (
          <GeoMapView
            countries={data.countries}
            chartData={data.chartData}
            onCountrySelect={(code) => {
              setCountryCode(code)
              fetchCountry(code)
            }}
          />
        )}
        {activeView === 'AI Signals' && (
          <AISignalsView signals={data.signals} />
        )}
        {activeView === 'Intelligence' && (
          <IntelligencePanel />
        )}
        {activeView === 'Trading Signals' && (
          <TradingSignalsPanel />
        )}
        {activeView === 'Geo Risk Index' && (
          <GeopoliticalIndexPanel />
        )}
        {activeView === 'Market Impact' && (
          <MarketImpactPanel />
        )}
        {activeView === 'Portfolio' && (
          <PortfolioView portfolio={data.portfolio} />
        )}
        {activeView === 'Live Feeds' && (
          <LiveFeedsView feeds={data.feeds} />
        )}
        {activeView === 'Widgets' && (
          <WidgetBoard />
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

        <div className="bottom-signals">
          {data.signals.slice(0, 3).map(sig => (
            <div key={sig.id} className="signal-pill">
              <span className={`action-dot ${sig.action.toLowerCase()}`} />
              <span className="signal-asset">{sig.asset}</span>
              <span className="signal-conf">{Math.round((sig.confidence || 0) * 100)}%</span>
              <span className="signal-move">{sig.move}</span>
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

      <CountryDrawer
        detail={countryDetail}
        loading={countryLoading}
        onClose={() => { setCountryCode(null); setCountryDetail(null); }}
        key={countryCode || 'drawer'}
      />
    </div>
  )
}
