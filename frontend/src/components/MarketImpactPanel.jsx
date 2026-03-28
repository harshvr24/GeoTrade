import { useEffect, useState } from 'react'
import { DEMO_DATA } from '../data'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export default function MarketImpactPanel() {
  const [marketData, setMarketData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedAsset, setSelectedAsset] = useState(null)

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/market-impact-analysis`)
        if (!response.ok) throw new Error('Failed to fetch market data')
        const data = await response.json()
        setMarketData(data)
        if (data.top_affected_assets?.length > 0) {
          setSelectedAsset(data.top_affected_assets[0])
        }
      } catch (err) {
        setError(err.message)
        // fallback to demo placeholders
        const fallback = {
          top_affected_assets: [
            { asset: 'WTI', composite_impact: 2.4, events_affecting: 3, highest_severity: 'high' },
            { asset: 'XAU', composite_impact: 2.1, events_affecting: 2, highest_severity: 'critical' },
          ],
          summary: {
            energy_assets_affected: 2,
            equities_affected: 1,
            forex_affected: 1,
            precious_metals_affected: 1,
          },
        }
        setMarketData(fallback)
        setSelectedAsset(fallback.top_affected_assets[0])
      } finally {
        setLoading(false)
      }
    }

    fetchMarketData()
    const interval = setInterval(fetchMarketData, 45000)
    return () => clearInterval(interval)
  }, [])

  const getImpactColor = (impact) => {
    if (impact >= 2.5) return 'text-red-500'
    if (impact >= 2.0) return 'text-orange-500'
    if (impact >= 1.5) return 'text-yellow-500'
    return 'text-blue-400'
  }

  const getSeverityColor = (severity) => {
    if (severity === 'critical') return 'bg-red-900/40 border-red-500'
    if (severity === 'high') return 'bg-orange-900/40 border-orange-500'
    if (severity === 'medium') return 'bg-yellow-900/40 border-yellow-500'
    return 'bg-blue-900/40 border-blue-500'
  }

  if (loading) return <div className="text-gray-400">Loading market data...</div>
  if (error) return <div className="text-red-400">Error: {error}</div>
  if (!marketData) return <div className="text-gray-400">No market data available</div>

  const { top_affected_assets, summary } = marketData

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-4">💹 Market Impact Analysis</h2>
        
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-red-900/20 border border-red-700 rounded p-3">
            <div className="text-2xl font-bold text-red-400">{summary.energy_assets_affected}</div>
            <div className="text-xs text-gray-400">Energy Assets Hit</div>
          </div>
          <div className="bg-orange-900/20 border border-orange-700 rounded p-3">
            <div className="text-2xl font-bold text-orange-400">{summary.equities_affected}</div>
            <div className="text-xs text-gray-400">Equities in Focus</div>
          </div>
          <div className="bg-yellow-900/20 border border-yellow-700 rounded p-3">
            <div className="text-2xl font-bold text-yellow-400">{summary.forex_affected}</div>
            <div className="text-xs text-gray-400">FX Pairs Affected</div>
          </div>
          <div className="bg-blue-900/20 border border-blue-700 rounded p-3">
            <div className="text-2xl font-bold text-blue-400">{summary.precious_metals_affected}</div>
            <div className="text-xs text-gray-400">Metals Trading</div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-white mb-3 uppercase tracking-wider">Top Affected Assets</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {top_affected_assets.slice(0, 10).map((asset, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedAsset(asset)}
              className={`rounded-lg p-3 cursor-pointer transition-all border ${
                selectedAsset?.asset === asset.asset
                  ? 'bg-gray-700 border-blue-500'
                  : 'bg-gray-800 border-gray-700 hover:border-gray-600'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-white">{asset.asset}</span>
                  <span className={`text-lg font-bold ${getImpactColor(asset.composite_impact)}`}>
                    {asset.composite_impact}
                  </span>
                </div>
                <span className="text-xs font-semibold text-gray-400">{asset.events_affecting} event(s)</span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-700 rounded h-2">
                  <div
                    className={`h-2 rounded transition-all ${getImpactColor(asset.composite_impact)}`}
                    style={{ width: `${(asset.composite_impact / 3) * 100}%` }}
                  />
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded ${getSeverityColor(asset.highest_severity)}`}>
                  {asset.highest_severity}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedAsset && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-bold text-white mb-3">📈 {selectedAsset.asset} Analysis</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Composite Impact Score:</span>
              <span className={`font-bold ${getImpactColor(selectedAsset.composite_impact)}`}>
                {selectedAsset.composite_impact}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Events Affecting:</span>
              <span className="font-bold text-white">{selectedAsset.events_affecting}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Highest Severity:</span>
              <span className={`font-bold px-2 py-1 rounded text-xs ${getSeverityColor(selectedAsset.highest_severity)}`}>
                {selectedAsset.highest_severity}
              </span>
            </div>
            <div className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-700">
              This asset is significantly exposed to current geopolitical events. Monitor closely for trading opportunities.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
