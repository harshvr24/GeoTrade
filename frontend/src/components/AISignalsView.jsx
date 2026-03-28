import { useState, useMemo } from 'react'

const ASSET_CLASSES = [
  { id: 'all',       icon: '◈', label: 'All' },
  { id: 'commod',    icon: '⛽', label: 'Commodities' },
  { id: 'equity',    icon: '📈', label: 'Equity Indices' },
  { id: 'forex',     icon: '💱', label: 'Forex' },
  { id: 'crypto',    icon: '₿',  label: 'Crypto' },
  { id: 'stocks',    icon: '🏢', label: 'Stocks' },
  { id: 'etfs',      icon: '📊', label: 'ETFs' },
  { id: 'bonds',     icon: '📄', label: 'Bonds' },
]

const CLASS_MAP = {
  'XAU/USD': 'commod', 'WTI': 'commod', 'GAS': 'commod',
  'SPX': 'equity', 'LMT': 'stocks', 'BTCUSD': 'crypto',
  'EURUSD': 'forex', 'INR/USD': 'forex',
}

const DETAIL_TABS = ['Trade Setup', 'AI Reasoning', 'Timeline', 'Reliability']

export default function AISignalsView({ signals }) {
  const [assetClass,    setAssetClass]    = useState('all')
  const [dirFilter,     setDirFilter]     = useState('ALL')
  const [selectedId,    setSelectedId]    = useState(signals?.[0]?.id)
  const [activeTab,     setActiveTab]     = useState('Trade Setup')
  const [search,        setSearch]        = useState('')
  const [sortBy,        setSortBy]        = useState('confidence')

  const filtered = useMemo(() => {
    const base = (signals || []).filter(s => {
      const cls = assetClass === 'all' || CLASS_MAP[s.asset] === assetClass
      const dir = dirFilter  === 'ALL' || s.action === dirFilter
      const srch = !search   || s.asset.toLowerCase().includes(search.toLowerCase())
      return cls && dir && srch
    })
    if (sortBy === 'confidence') {
      return base.sort((a,b) => (b.confidence || 0) - (a.confidence || 0))
    }
    if (sortBy === 'asset') {
      return base.sort((a,b) => a.asset.localeCompare(b.asset))
    }
    return base
  }, [signals, assetClass, dirFilter, search, sortBy])

  const selected = signals?.find(s => s.id === selectedId) || filtered[0]

  const confPct = selected ? Math.round(selected.confidence * 100) : 0

  return (
    <div className="signals-layout">
      {/* Left narrow filter sidebar */}
      <div className="signals-sidebar">
        <div className="sidebar-section-label">Asset Class</div>
        {ASSET_CLASSES.map(c => (
          <button
            key={c.id}
            className={`sidebar-filter-btn ${assetClass === c.id ? 'active' : ''}`}
            onClick={() => setAssetClass(c.id)}
          >
            <span className="sfb-icon">{c.icon}</span>
            {c.label}
          </button>
        ))}

        <div className="sidebar-divider" />
        <div className="sidebar-section-label">Direction</div>
        {['ALL','BUY','SELL','HOLD'].map(d => (
          <button
            key={d}
            className={`direction-btn ${dirFilter === d ? `active ${d.toLowerCase()}` : ''}`}
            onClick={() => setDirFilter(d)}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Signal list */}
      <div className="signals-list-panel">
        <div className="slp-header">
          <input
            className="slp-search"
            placeholder="🔍 Search model..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={`direction-btn ${sortBy === 'confidence' ? 'active' : ''}`} onClick={() => setSortBy('confidence')}>Sort: Conf</button>
            <button className={`direction-btn ${sortBy === 'asset' ? 'active' : ''}`} onClick={() => setSortBy('asset')}>Sort: Asset</button>
          </div>
        </div>
        <div className="slp-list">
          {filtered.length === 0 && (
            <div style={{ padding: '20px 12px', fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
              No signals match filter
            </div>
          )}
          {filtered.map(s => (
            <div
              key={s.id}
              className={`slp-item ${selectedId === s.id ? 'active' : ''}`}
              onClick={() => { setSelectedId(s.id); setActiveTab('Trade Setup') }}
            >
              <div className="slp-item-top">
                <span className="slp-asset">{s.asset}</span>
                <span className={`slp-conf ${s.action === 'BUY' ? 'pos' : s.action === 'SELL' ? 'neg' : 'neu'}`}>
                  {Math.round(s.confidence * 100)}%
                </span>
              </div>
              <div className="slp-cat">
                {s.category} · {s.changeP || s.move || ''}
              </div>
              <div className="slp-bars">
                <div className="slp-bar-row">
                  <span className="slp-bar-label">Bull</span>
                  <div className="slp-bar-bg">
                    <div className="slp-bar-fill"
                      style={{ width: `${s.bullStrength}%`, background: 'var(--green)' }} />
                  </div>
                </div>
                <div className="slp-bar-row">
                  <span className="slp-bar-label">Bear</span>
                  <div className="slp-bar-bg">
                    <div className="slp-bar-fill"
                      style={{ width: `${s.bearStrength}%`, background: 'var(--red)' }} />
                  </div>
                </div>
              </div>
              <div className="slp-trigger">▸ {s.trigger}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selected ? (
        <div className="signal-detail-panel">
          {/* Header */}
          <div className="sdp-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="sdp-asset-name">{selected.asset}</span>
                <span className={`action-badge ${selected.action.toLowerCase()}`}>
                  {selected.action}
                </span>
              </div>
              <div className="sdp-asset-sub">{selected.category}</div>
              <div className="sdp-asset-sub" style={{ marginTop: 2 }}>{selected.rationale}</div>
            </div>
            <div className="sdp-right">
              <span className={`sdp-conf-large ${selected.action === 'BUY' ? 'pos' : selected.action === 'SELL' ? 'neg' : ''}`}>
                {confPct}%
              </span>
              <span className="sdp-conf-label">Confidence</span>
            </div>
          </div>

          {/* Strength bar */}
          <div className="strength-section">
            <span className="strength-pct bull">{selected.bullStrength}%</span>
            <span className="strength-label">Bullish Strength</span>
            <div className="strength-bar-wrap">
              <div className="strength-bar-bull"
                style={{ width: `${selected.bullStrength / 2}%` }} />
              <div className="strength-bar-bear"
                style={{ width: `${selected.bearStrength / 2}%` }} />
            </div>
            <span className="strength-label">Bearish Strength</span>
            <span className="strength-pct bear">{selected.bearStrength}%</span>
          </div>

          {/* Volatility tags */}
          <div className="vol-tags">
            <span className="vol-tag med-vol">{selected.volatility} Volatility</span>
            {selected.timeframes.map(t => (
              <span key={t} className="vol-tag timeframe">{t}</span>
            ))}
          </div>

          {/* Triggering event */}
          <div className="trigger-section">
            <div className="trigger-label">Triggering Event</div>
            <div className="trigger-text">{selected.trigger}</div>
            <div className="trigger-sub">{selected.triggerSub}</div>
          </div>

          {/* Tabs */}
          <div className="sdp-tabs">
            {DETAIL_TABS.map(t => (
              <button
                key={t}
                className={`sdp-tab ${activeTab === t ? 'active' : ''}`}
                onClick={() => setActiveTab(t)}
              >
                {t === 'Trade Setup'   && '◎'}
                {t === 'AI Reasoning'  && '✦'}
                {t === 'Timeline'      && '⏱'}
                {t === 'Reliability'   && '⚡'}
                {' '}{t}
              </button>
            ))}
          </div>

          {/* Tab body */}
          <div className="sdp-body">
            {activeTab === 'Trade Setup' && (
              <>
                <div className="trade-structure">
                  <div className="ts-cell">
                    <span className="ts-label">Current Price</span>
                    <span className="ts-value">{selected.entry.toFixed(2)}</span>
                  </div>
                  <div className="ts-cell">
                    <span className="ts-label">Entry</span>
                    <span className="ts-value entry">{selected.entry.toFixed(2)}</span>
                  </div>
                  <div className="ts-cell">
                    <span className="ts-label">Stop Loss</span>
                    <span className="ts-value stop">{selected.stopLoss.toFixed(2)}</span>
                  </div>
                  <div className="ts-cell">
                    <span className="ts-label">Target</span>
                    <span className="ts-value target">{selected.target.toFixed(2)}</span>
                  </div>
                  <div className="ts-cell">
                    <span className="ts-label">R:R Ratio</span>
                    <span className="ts-value rr">{selected.rr}</span>
                  </div>
                  <div className="ts-cell">
                    <span className="ts-label">Win Rate</span>
                    <span className="ts-value wr">{selected.winRate}</span>
                  </div>
                </div>

                {/* Risk/Reward bar */}
                <div className="rr-bar-section">
                  <div className="rr-bar-label">
                    <span>Risk to Reward</span>
                  </div>
                  <div className="rr-bar-bg">
                    {(() => {
                      const total  = selected.riskAmount + selected.rewardAmount
                      const riskW  = (selected.riskAmount  / total) * 100
                      const rewW   = (selected.rewardAmount / total) * 100
                      return (
                        <>
                          <div className="rr-bar-risk"   style={{ width: `${riskW}%` }} />
                          <div className="rr-bar-reward" style={{ left: `${riskW}%`, width: `${rewW}%` }} />
                        </>
                      )
                    })()}
                  </div>
                  <div className="rr-bar-values">
                    <span className="risk-val">Risk: -{selected.riskAmount.toFixed(3)}</span>
                    <span className="reward-val">Reward: +{selected.rewardAmount.toFixed(3)}</span>
                  </div>
                </div>

                <div className="disclaimer">
                  <span className="disc-icon">⚠</span>
                  <span>Educational purposes only. Not financial advice. Always perform your own due diligence.
                    Model v1.4 · Data as of {new Date().toLocaleString('en-US', { hour12: false })}</span>
                </div>
              </>
            )}

            {activeTab === 'AI Reasoning' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--muted)' }}>
                  {selected.rationale}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>
                  <b style={{ color: 'var(--text)' }}>Triggering event:</b> {selected.trigger}.<br />
                  {selected.triggerSub}
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>⚠ Risk Flags</div>
                  {selected.riskFlags.map(f => (
                    <div key={f} style={{ fontSize: 11, color: 'var(--muted)', paddingLeft: 12, marginBottom: 4 }}>— {f}</div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'Timeline' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Signal generated', 'Entry confirmed', 'Target 1 projected', 'Target 2 projected'].map((step, i) => (
                  <div key={step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      background: i === 0 ? 'var(--cyan)' : 'var(--bg3)',
                      border: '1px solid var(--border)',
                      display: 'grid', placeItems: 'center',
                      fontSize: 10, color: i === 0 ? '#000' : 'var(--muted)',
                      fontWeight: 700,
                    }}>
                      {i + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{step}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                        {i === 0 ? 'Now' : i === 1 ? '+2–4h' : i === 2 ? '+24–48h' : '+72h'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'Reliability' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  ['Win Rate',       `${selected.winRate}`,    selected.confidence * 100],
                  ['Confidence',     `${confPct}%`,             confPct],
                  ['Signal Strength', `${selected.bullStrength}%`, selected.bullStrength],
                ].map(([label, val, pct]) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                      <span style={{ color: 'var(--muted)' }}>{label}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>{val}</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--bg3)', borderRadius: 3 }}>
                      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, var(--cyan), var(--blue))' }} />
                    </div>
                  </div>
                ))}
                <div className="disclaimer" style={{ marginTop: 8 }}>
                  <span className="disc-icon">⚠</span>
                  <span>Educational purposes only. Not financial advice. Model v1.4 · Data as of {new Date().toLocaleString('en-US', { hour12: false })}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 13 }}>
          Select a signal to view details
        </div>
      )}
    </div>
  )
}
