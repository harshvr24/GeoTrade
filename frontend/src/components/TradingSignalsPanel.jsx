import { useEffect, useState } from 'react'
import { DEMO_DATA } from '../data'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export default function TradingSignalsPanel() {
  const [signals, setSignals] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchSignals = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/signals/trading`)
        if (!response.ok) throw new Error('Failed to fetch signals')
        const data = await response.json()
        setSignals(data.signals || [])
        setSummary(data.summary || null)
      } catch (err) {
        setError(err.message)
        // Fallback to demo data
        setSignals(DEMO_DATA.signals || [])
        setSummary({
          total_signals: DEMO_DATA.signals?.length || 0,
          buy_signals: (DEMO_DATA.signals || []).filter(s => s.action === 'BUY').length,
          sell_signals: (DEMO_DATA.signals || []).filter(s => s.action === 'SELL').length,
          average_confidence: (DEMO_DATA.signals || []).reduce((a, s) => a + (s.confidence || 0), 0) / Math.max((DEMO_DATA.signals || []).length, 1),
        })
      } finally {
        setLoading(false)
      }
    }

    fetchSignals()
    const interval = setInterval(fetchSignals, 30000)
    return () => clearInterval(interval)
  }, [])

  const getActionColor = (action) => {
    if (action === 'BUY') return 'text-green-500'
    if (action === 'SELL') return 'text-red-500'
    return 'text-yellow-500'
  }

  const getConfidenceBar = (confidence) => {
    const percentage = (confidence * 100)
    return (
      <div className="w-full bg-gray-700 rounded h-2">
        <div
          className={`h-2 rounded transition-all ${
            confidence > 0.7 ? 'bg-green-500' : confidence > 0.6 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    )
  }

  if (loading) return <div className="text-gray-400">Loading trading signals...</div>
  if (error) return <div className="text-red-400">Error: {error}</div>

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white mb-6">🎯 Trading Signals</h2>

      {summary && (
        <div className="grid grid-cols-3 gap-2 text-sm text-gray-300">
          <div className="bg-gray-800/70 border border-gray-700 rounded p-3">
            <div className="text-xs text-gray-400">Total</div>
            <div className="text-xl font-bold text-white">{summary.total_signals ?? summary.total ?? signals.length}</div>
          </div>
          <div className="bg-gray-800/70 border border-gray-700 rounded p-3">
            <div className="text-xs text-gray-400">Buy</div>
            <div className="text-xl font-bold text-green-400">{summary.buy_signals ?? summary.buy ?? 0}</div>
          </div>
          <div className="bg-gray-800/70 border border-gray-700 rounded p-3">
            <div className="text-xs text-gray-400">Avg Conf</div>
            <div className="text-xl font-bold text-cyan-400">
              {Math.round((summary.average_confidence ?? summary.avg_confidence ?? 0) * 100)}%
            </div>
          </div>
        </div>
      )}

      {signals.length === 0 ? (
        <p className="text-gray-400">No active trading signals at this time.</p>
      ) : (
        <div className="space-y-3">
          {signals.map((signal, idx) => (
            <div
              key={idx}
              className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`text-lg font-bold ${getActionColor(signal.action)}`}>
                      {signal.action}
                    </span>
                    <span className="text-2xl font-bold text-white">{signal.asset}</span>
                    <span className="text-gray-400 text-sm">{signal.market}</span>
                  </div>
                  <p className="text-gray-300 text-sm">{signal.rationale}</p>
                </div>
                <div className="text-right ml-4">
                  <div className="text-sm font-mono text-gray-400">
                    Entry: <span className="text-white">{signal.entry}</span>
                  </div>
                  <div className="text-sm font-mono text-green-400 mt-1">
                    Move: {signal.move}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Confidence Score</span>
                  <span className="font-bold text-white">{(signal.confidence * 100).toFixed(0)}%</span>
                </div>
                {getConfidenceBar(signal.confidence)}
              </div>

              <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                <span className="bg-gray-700 px-2 py-1 rounded">{signal.horizon}</span>
                {signal.risk_flags && signal.risk_flags.length > 0 && (
                  <span className="text-yellow-400">⚠ Risk: {signal.risk_flags[0]}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
