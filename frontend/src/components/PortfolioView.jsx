import { useState, useMemo } from 'react'

export default function PortfolioView({ portfolio }) {
  const [sortBy, setSortBy] = useState('pnl')
  const [filterStatus, setFilterStatus] = useState('all')

  const filtered = useMemo(() => {
    let arr = portfolio.positions
    if (filterStatus !== 'all') {
      arr = arr.filter(p => p.status === filterStatus)
    }
    return arr.sort((a, b) => {
      if (sortBy === 'pnl') return b.pnl - a.pnl
      if (sortBy === 'time') return b.timeOpen.localeCompare(a.timeOpen)
      if (sortBy === 'asset') return a.asset.localeCompare(b.asset)
      return 0
    })
  }, [portfolio.positions, sortBy, filterStatus])

  const totalRisk = portfolio.positions.reduce((sum, p) => {
    const riskPerUnit = p.entryPrice * 0.01 // Assume 1% stop loss
    return sum + (riskPerUnit * p.size)
  }, 0)

  return (
    <div className="portfolio-layout">
      {/* Left: Summary Cards */}
      <div className="portfolio-left">
        {/* Overview Cards */}
        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-label">Portfolio Value</div>
            <div className="summary-value">${portfolio.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            <div className="summary-sub">Total allocated capital</div>
          </div>

          <div className="summary-card">
            <div className="summary-label">Total P&L</div>
            <div className={`summary-value ${portfolio.totalPnL >= 0 ? 'pos' : 'neg'}`}>
              {portfolio.totalPnL >= 0 ? '+' : ''}{portfolio.totalPnL.toFixed(2)}
            </div>
            <div className={`summary-sub ${portfolio.totalPnL >= 0 ? 'pos' : 'neg'}`}>
              {portfolio.totalPnLPct >= 0 ? '+' : ''}{portfolio.totalPnLPct.toFixed(2)}%
            </div>
          </div>

          <div className="summary-card">
            <div className="summary-label">Open Positions</div>
            <div className="summary-value">{portfolio.positions.length}</div>
            <div className="summary-sub">Active trades</div>
          </div>

          <div className="summary-card">
            <div className="summary-label">Total Risk</div>
            <div className="summary-value mono">${totalRisk.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
            <div className="summary-sub">Based on 1% stop loss</div>
          </div>
        </div>

        {/* Metrics */}
        <div className="metrics-section">
          <div className="metrics-title">Performance Metrics</div>
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-label">Win Rate</div>
              <div className="metric-value">{portfolio.metrics.winRate}%</div>
              <div className="metric-bar">
                <div className="metric-bar-fill" style={{ width: `${portfolio.metrics.winRate}%` }} />
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Sharpe Ratio</div>
              <div className="metric-value">{portfolio.metrics.sharpeRatio}</div>
              <div className="metric-bar">
                <div className="metric-bar-fill" style={{ width: `${Math.min(100, portfolio.metrics.sharpeRatio * 30)}%` }} />
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Max Drawdown</div>
              <div className={`metric-value ${portfolio.metrics.maxDrawdown < 0 ? 'neg' : ''}`}>
                {portfolio.metrics.maxDrawdown}%
              </div>
              <div className="metric-bar">
                <div className="metric-bar-fill" style={{ width: `${Math.abs(portfolio.metrics.maxDrawdown) * 5}%`, background: '#ff4444' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Positions List */}
      <div className="portfolio-right">
        <div className="positions-header">
          <div className="ph-title">Open Positions</div>
          
          <div className="ph-controls">
            <div className="filter-group">
              <button
                className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
                onClick={() => setFilterStatus('all')}
              >
                All
              </button>
              <button
                className={`filter-btn ${filterStatus === 'active' ? 'active' : ''}`}
                onClick={() => setFilterStatus('active')}
              >
                Active
              </button>
            </div>

            <div className="sort-group">
              <select className="sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                <option value="pnl">Sort by P&L</option>
                <option value="time">Sort by Time</option>
                <option value="asset">Sort by Asset</option>
              </select>
            </div>
          </div>
        </div>

        {/* Positions List */}
        <div className="positions-list">
          {filtered.length === 0 ? (
            <div className="empty-state">No positions to display</div>
          ) : (
            filtered.map(pos => (
              <div key={pos.id} className="position-card">
                <div className="pos-top">
                  <div className="pos-left">
                    <div className="pos-asset">{pos.asset}</div>
                    <div className="pos-size">{Math.abs(pos.size)} units</div>
                  </div>
                  <div className="pos-center">
                    <div className="pos-prices">
                      <span className="pos-entry-label">Entry</span>
                      <span className="pos-entry mono">{pos.entryPrice.toLocaleString()}</span>
                    </div>
                    <div className="pos-prices">
                      <span className="pos-current-label">Current</span>
                      <span className="pos-current mono">{pos.currentPrice.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="pos-right">
                    <div className={`pos-pnl ${pos.pnl >= 0 ? 'pos' : 'neg'}`}>
                      {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)}
                    </div>
                    <div className={`pos-pnl-pct ${pos.pnl >= 0 ? 'pos' : 'neg'}`}>
                      {pos.pnlPct >= 0 ? '+' : ''}{pos.pnlPct.toFixed(2)}%
                    </div>
                  </div>
                </div>

                <div className="pos-bottom">
                  <div className="pos-meta">
                    <span className={`pos-signal ${pos.signal.toLowerCase()}`}>{pos.signal}</span>
                    <span className="pos-rr">R:R {pos.riskRatio.toFixed(2)}x</span>
                    <span className="pos-time">Open {pos.timeOpen}</span>
                  </div>
                  <div className="pos-bar">
                    <div className="pos-bar-bg">
                      <div className={`pos-bar-fill ${pos.pnl >= 0 ? 'pos' : 'neg'}`}
                        style={{ width: `${Math.min(100, Math.abs(pos.pnlPct) * 10)}%` }} />
                    </div>
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
