import { useRef, useEffect, useState } from 'react'
import ChoroplethMap from './ChoroplethMap'
import CandlestickChart from './CandlestickChart'

const ASSETS = ['OIL', 'GAS', 'S&P500']

export default function GeoMapView({ countries, chartData }) {
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [selectedAsset,   setSelectedAsset]   = useState(null)
  const [filterLevel,     setFilterLevel]      = useState('all')

  const chartRef  = useRef(null)
  const [chartSize, setChartSize] = useState({ w: 600, h: 280 })

  useEffect(() => {
    const el = chartRef.current
    if (!el) return
    const ro = new ResizeObserver(e => {
      const { width, height } = e[0].contentRect
      if (width > 0 && height > 0) setChartSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const filters = ['all','critical','high','medium','low']
  const filteredCountries = filterLevel === 'all'
    ? countries
    : countries.filter(c => c.level === filterLevel)

  const asset = selectedAsset ? chartData[selectedAsset] : null

  return (
    <div className="geomap-layout">
      {/* Left: flat map */}
      <div className="map-section">
        <div className="map-top-bar">
          <span className="map-label">Market Impact Map</span>
          <button className="filter-btn">⚙ Filters</button>
        </div>

        <div className="map-filters">
          {filters.map(f => (
            <button
              key={f}
              className={`map-filter-chip ${filterLevel === f ? 'active' : ''}`}
              onClick={() => setFilterLevel(f)}
            >
              {f === 'all' ? '◉ All' :
               f === 'critical' ? '🔴 Critical' :
               f === 'high'     ? '🟠 High' :
               f === 'medium'   ? '🔵 Medium' :
                                  '🟢 Low'}
            </button>
          ))}
        </div>

        <div className="choropleth-map">
          <ChoroplethMap
            countries={filteredCountries}
            onCountryClick={setSelectedCountry}
            selectedCode={selectedCountry?.code}
          />
        </div>

        <div className="map-bottom-bar">
          <div className="map-legend">
            {[['critical','#ef4444'],['high','#f97316'],['medium','#3b82f6'],['low','#22c55e']].map(([l,c]) => (
              <div key={l} className="map-legend-item">
                <span className="map-legend-dot" style={{ background: c }} />
                {l.charAt(0).toUpperCase()+l.slice(1)}
              </div>
            ))}
          </div>
          {selectedCountry && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--cyan)' }}>
              {selectedCountry.name}
            </span>
          )}
        </div>
      </div>

      {/* Right: asset chart */}
      <div className="chart-section">
        <div className="chart-top">
          {/* Asset tabs */}
          <div className="asset-tabs">
            {ASSETS.map(a => {
              const d = chartData[a]
              return (
                <div
                  key={a}
                  className={`asset-tab ${selectedAsset === a ? 'active' : ''}`}
                  onClick={() => setSelectedAsset(a)}
                >
                  <span className="at-name">{a}</span>
                  <span className="at-price mono">{d.price.toLocaleString()}</span>
                  <span className={`at-chg ${d.change >= 0 ? 'pos' : 'neg'}`}>{d.changeP}</span>
                </div>
              )
            })}
          </div>

          {asset && (
            <div className="selected-asset-info">
              <span className="sai-name">{asset.fullName}</span>
              <span className="sai-type">MARKET</span>
              <span className={`sai-change ${asset.change >= 0 ? 'pos' : 'neg'}`}>
                ▲ {Math.abs(asset.change).toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        <div className="chart-body" ref={chartRef}>
          {!selectedAsset ? (
            <div className="select-asset-placeholder">Select an asset above</div>
          ) : (
            <CandlestickChart
              candles={asset.candles}
              width={chartSize.w}
              height={chartSize.h - 8}
            />
          )}
        </div>

        <div className="chart-footer">
          {selectedAsset && (
            <>
              {/* OHLC summary */}
              <div style={{ display: 'flex', gap: 24, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: 'var(--muted)' }}>
                {(() => {
                  const c = asset.candles
                  const last = c[c.length - 1]
                  const open = c[0].open
                  const hi   = Math.max(...c.map(x => x.high))
                  const lo   = Math.min(...c.map(x => x.low))
                  return (
                    <>
                      <span>O: <b style={{color:'var(--text)'}}>{open.toFixed(2)}</b></span>
                      <span>H: <b style={{color:'var(--green)'}}>{hi.toFixed(2)}</b></span>
                      <span>L: <b style={{color:'var(--red)'}}>{lo.toFixed(2)}</b></span>
                      <span>C: <b style={{color:'var(--cyan)'}}>{last.close.toFixed(2)}</b></span>
                    </>
                  )
                })()}
              </div>
              <div className="sector-label">
                <span>↗</span> Sector Exposure
              </div>
              <div className="sector-bars">
                {[
                  { name: 'Energy',  pct: 78, color: '#ef4444' },
                  { name: 'Defense', pct: 65, color: '#00d4ff' },
                ].map(s => (
                  <div key={s.name} className="sector-bar-row">
                    <span className="sector-bar-name">{s.name}</span>
                    <div className="sector-bar-bg">
                      <div className="sector-bar-fill"
                        style={{ width: `${s.pct}%`, background: s.color }} />
                    </div>
                    <span className="sector-bar-pct">{s.pct}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
