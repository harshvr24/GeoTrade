import { useEffect, useRef, useState, useMemo } from 'react'
import Globe from 'react-globe.gl'

const RISK_COLORS = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#3b82f6',
  low:      '#22c55e',
}

// Country lat/lng for globe points
const COORDS = {
  IRN: [32.4, 53.7],  ISR: [31.0, 34.8],  RUS: [61.5, 105.3],
  PRK: [40.3, 127.5], DEU: [51.2, 10.5],  TWN: [23.7, 121.0],
  CHN: [35.9, 104.2], UKR: [48.4, 31.2],  USA: [37.1, -95.7],
  IND: [20.6, 78.9],  GBR: [55.4, -3.4],  FRA: [46.2, 2.2],
  SAU: [23.9, 45.1],  PAK: [30.4, 69.3],  SYR: [34.8, 38.9],
  LBN: [33.9, 35.9],  TUR: [38.9, 35.2],  JPN: [36.2, 138.3],
  NGA: [9.1,  8.7],   ZAF: [-30.6, 22.9], AUS: [-25.3, 133.8],
  BRA: [-14.2,-51.9], CAN: [56.1, -106.3],MEX: [23.6,-102.6],
  IDN: [-0.8, 113.9], ETH: [9.1, 40.5],   VEN: [6.4, -66.6],
}

export default function GlobeView({ countries, signals, focusSignal, onCountryClick }) {
  const containerRef = useRef(null)
  const [size, setSize] = useState({ w: 760, h: 560 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) setSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const points = useMemo(() =>
    countries
      .filter(c => COORDS[c.code])
      .map(c => ({
        ...c,
        lat:   COORDS[c.code][0],
        lng:   COORDS[c.code][1],
        size:  Math.max(0.15, c.risk / 300),
        color: RISK_COLORS[c.level] || '#3b82f6',
      })),
    [countries]
  )

  const showSpikes = false

  // Build arc network grouped by severity color (critical/high/medium/low)
  const arcs = useMemo(() => {
    const groups = points.reduce((acc, p) => {
      acc[p.level] = acc[p.level] || []
      acc[p.level].push(p)
      return acc
    }, {})

    const makeGroupArcs = (arr) => {
      if (!arr || arr.length < 2) return []
      const sorted = [...arr].sort((a, b) => b.risk - a.risk)
      const hub = sorted[0]
      const spokes = sorted.slice(1).map(p => ({
        startLat: p.lat,
        startLng: p.lng,
        endLat: hub.lat,
        endLng: hub.lng,
        color: [p.color, hub.color],
        dashLength: 0.32,
        dashGap: 1.05,
      }))
      const ring = sorted.map((p, idx) => {
        const q = sorted[(idx + 1) % sorted.length]
        return {
          startLat: p.lat,
          startLng: p.lng,
          endLat: q.lat,
          endLng: q.lng,
          color: [p.color, q.color],
          dashLength: 0.24,
          dashGap: 1.25,
        }
      })
      return [...spokes, ...ring]
    }

    return [
      ...makeGroupArcs(groups.critical),
      ...makeGroupArcs(groups.high),
      ...makeGroupArcs(groups.medium),
      ...makeGroupArcs(groups.low),
    ]
  }, [points])

  const spxSignal  = signals?.find(s => s.asset === 'SPX')
  const hasFocus   = focusSignal && focusSignal.asset

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Globe */}
      <div ref={containerRef} className="globe-section">
        <div className="globe-overlay-bar">
          <span>● LIVE</span>
          &nbsp;Global GTI&nbsp;<span>{71.4}</span>
        </div>

        <Globe
          width={size.w}
          height={size.h}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundColor="rgba(0,0,0,0)"
          atmosphereColor="#1a4080"
          atmosphereAltitude={0.12}
          pointsData={showSpikes ? points : []}
          pointColor="color"
          pointAltitude={showSpikes ? "size" : () => 0}
          pointRadius={showSpikes ? 0.5 : 0}
          pointLabel={p => `<div style="background:#0c1420;border:1px solid rgba(255,255,255,0.1);padding:6px 10px;border-radius:6px;font-size:12px"><b>${p.name}</b> · ${p.region}<br/><span style="color:${p.color}">Risk ${p.risk} — ${p.level.toUpperCase()}</span></div>`}
          onPointClick={p => onCountryClick(p)}
          arcsData={arcs}
          arcColor={'color'}
          arcDashLength={'dashLength'}
          arcDashGap={'dashGap'}
          arcDashAnimateTime={2600}
          arcStroke={1.15}
          arcAltitudeAutoScale={0.5}
        />

        <div className="risk-legend">
          {[['critical','#ef4444'],['high','#f97316'],['medium','#3b82f6'],['low','#22c55e']].map(([l,c]) => (
            <div key={l} className="legend-row">
              <span className="legend-swatch" style={{ background: c }} />
              {l.charAt(0).toUpperCase() + l.slice(1)}
            </div>
          ))}
        </div>

        <div className="globe-hint">◎ Click any country to view market impact</div>
      </div>

      {/* Right signals panel */}
      <div className="signal-panel">
        <div className="signal-panel-header">
          <span className="panel-title">Signals</span>
          <span style={{ fontSize: 10, color: 'var(--muted)' }}>↑ Live</span>
        </div>

        <div className="signal-panel-body">
          {/* Focus signal card */}
          {hasFocus && (
            <div className="focus-signal-card">
              <div className="fsc-top">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                    <span className="fsc-asset">{focusSignal.asset}</span>
                    <span className={`action-badge ${focusSignal.action.toLowerCase()}`}>
                      {focusSignal.action}
                    </span>
                  </div>
                  <div className="fsc-category">{focusSignal.category}</div>
                </div>
                <div className="fsc-right">
                  <div className="fsc-price">${Number(focusSignal.price || 0).toLocaleString()}</div>
                  <div className={`fsc-change ${(focusSignal.change || 0) >= 0 ? 'pos' : 'neg'}`}>
                    {focusSignal.changeP || focusSignal.move || ''}
                  </div>
                </div>
              </div>

              <div className="conf-row">
                <span>Confidence: {Math.round((focusSignal.confidence || 0) * 100)}%</span>
                <span>Uncertainty: {Math.round((1 - (focusSignal.confidence || 0)) * 100)}%</span>
              </div>
              <div className="conf-bar-bg">
                <div className="conf-bar-fill" style={{ width: `${(focusSignal.confidence || 0) * 100}%` }} />
              </div>

              <div className="ai-section-label">AI Analysis</div>
              <p className="fsc-rationale">{focusSignal.rationale}</p>

              <div className="risk-section-label">Risk Factors</div>
              <div className="risk-flags">
                {(focusSignal.riskFlags || focusSignal.risk_flags || []).map(f => (
                  <div key={f} className="risk-flag-item">{f}</div>
                ))}
              </div>
            </div>
          )}

          {/* All signals list */}
          <div className="all-signals-section">
            <div className="all-signals-header">
              <span>All Signals</span>
              <span>{signals?.length}</span>
            </div>
            {signals?.map(s => (
              <div key={s.id} className="signal-item">
                <div className="si-left">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                    <span className="si-asset">{s.asset}</span>
                    <span className={`action-badge ${s.action.toLowerCase()}`} style={{ fontSize: 9, padding: '1px 5px' }}>
                      {s.action}
                    </span>
                  </div>
                  <div className="si-cat">{s.category}</div>
                  <div className="si-bar-row">
                    <div className="si-bar-bg">
                      <div className={`si-bar-fill ${s.action.toLowerCase()}`}
                        style={{ width: `${s.confidence * 100}%` }} />
                    </div>
                  </div>
                </div>
                <div className="si-right">
                  <div className={`si-move ${s.change >= 0 ? 'pos' : 'neg'}`}>{s.changeP}</div>
                  <div className="si-entry">${Number(s.price || 0).toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
