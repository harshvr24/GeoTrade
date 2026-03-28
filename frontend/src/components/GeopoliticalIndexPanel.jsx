import { useEffect, useState } from 'react'
import { DEMO_DATA } from '../data'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export default function GeopoliticalIndexPanel() {
  const [gtiData, setGtiData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchGTI = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/geopolitical-index`)
        if (!response.ok) throw new Error('Failed to fetch GTI')
        const data = await response.json()
        setGtiData(data)
      } catch (err) {
        setError(err.message)
        // fallback to demo values
        setGtiData({
          gti: DEMO_DATA.gti,
          gti_delta: DEMO_DATA.gti_delta,
          risk_summary: { critical_events: 0, high_events: 0, high_risk_countries: 0, total_countries_monitored: DEMO_DATA.countries.length },
          regional_breakdown: {},
          top_risk_countries: DEMO_DATA.countries.slice(0, 5).map(c => ({
            country_code: c.code,
            country_name: c.name,
            region: c.region,
            risk_score: c.risk,
            risk_level: c.level,
          })),
        })
      } finally {
        setLoading(false)
      }
    }

    fetchGTI()
    const interval = setInterval(fetchGTI, 60000)
    return () => clearInterval(interval)
  }, [])

  const getGTIColor = (gti) => {
    if (gti >= 75) return 'text-red-500'
    if (gti >= 50) return 'text-orange-500'
    if (gti >= 25) return 'text-yellow-500'
    return 'text-green-500'
  }

  const getRiskLevelBg = (level) => {
    if (level === 'Critical') return 'bg-red-900/30 border-red-500'
    if (level === 'High') return 'bg-orange-900/30 border-orange-500'
    if (level === 'Medium') return 'bg-yellow-900/30 border-yellow-500'
    return 'bg-green-900/30 border-green-500'
  }

  if (loading) return <div className="text-gray-400">Loading GTI data...</div>
  if (error) return <div className="text-red-400">Error: {error}</div>
  if (!gtiData) return <div className="text-gray-400">No data available</div>

  const { gti, gti_delta, risk_summary, regional_breakdown, top_risk_countries } = gtiData

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-4">📊 Geopolitical Tension Index (GTI)</h2>
        
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-4">
          <div className="flex items-baseline gap-2 mb-4">
            <span className={`text-5xl font-bold ${getGTIColor(gti)}`}>{gti}</span>
            <span className={gti_delta > 0 ? 'text-red-400' : 'text-green-400'}>
              {gti_delta > 0 ? '↑' : '↓'} {Math.abs(gti_delta)}
            </span>
          </div>
          <p className="text-gray-400 text-sm">
            {gti >= 75 && '🔴 CRITICAL - Elevated global tension'}
            {gti >= 50 && gti < 75 && '🟠 HIGH - Significant geopolitical risks'}
            {gti >= 25 && gti < 50 && '🟡 MODERATE - Elevated monitoring required'}
            {gti < 25 && '🟢 LOW - Relatively stable geopolitical environment'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-red-900/20 border border-red-700 rounded p-3">
          <div className="text-2xl font-bold text-red-400">{risk_summary.critical_events}</div>
          <div className="text-xs text-gray-400">Critical Events</div>
        </div>
        <div className="bg-orange-900/20 border border-orange-700 rounded p-3">
          <div className="text-2xl font-bold text-orange-400">{risk_summary.high_events}</div>
          <div className="text-xs text-gray-400">High Severity</div>
        </div>
        <div className="bg-red-900/20 border border-red-700 rounded p-3">
          <div className="text-2xl font-bold text-red-400">{risk_summary.high_risk_countries}</div>
          <div className="text-xs text-gray-400">High-Risk Countries</div>
        </div>
        <div className="bg-blue-900/20 border border-blue-700 rounded p-3">
          <div className="text-2xl font-bold text-blue-400">{risk_summary.total_countries_monitored}</div>
          <div className="text-xs text-gray-400">Monitored</div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-white mb-3 uppercase">Regional Breakdown</h3>
        <div className="space-y-2">
          {Object.entries(regional_breakdown)
            .sort((a, b) => b[1].avg_risk - a[1].avg_risk)
            .slice(0, 5)
            .map(([region, data]) => (
              <div key={region} className={`rounded p-2 border ${getRiskLevelBg(data.avg_risk >= 70 ? 'Critical' : data.avg_risk >= 50 ? 'High' : 'Medium')}`}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-white font-medium">{region}</span>
                  <span className="text-white font-bold">{data.avg_risk}</span>
                </div>
                <div className="bg-gray-700 rounded h-1.5">
                  <div
                    className={`h-1.5 rounded transition-all ${
                      data.avg_risk >= 70 ? 'bg-red-500' : data.avg_risk >= 50 ? 'bg-orange-500' : 'bg-yellow-500'
                    }`}
                    style={{ width: `${(data.avg_risk / 100) * 100}%` }}
                  />
                </div>
              </div>
            ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-white mb-3 uppercase">🔴 Top Risk Countries</h3>
        <div className="space-y-2">
          {top_risk_countries.map((country) => (
            <div key={country.country_code} className="flex items-center justify-between bg-gray-800 border border-gray-700 rounded p-2">
              <div>
                <div className="font-semibold text-white">{country.country_name}</div>
                <div className="text-xs text-gray-400">{country.region}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-white">{country.risk_score}</div>
                <div className={`text-xs font-semibold ${
                  country.risk_level === 'Critical' ? 'text-red-400' : 
                  country.risk_level === 'High' ? 'text-orange-400' : 
                  country.risk_level === 'Medium' ? 'text-yellow-400' : 'text-green-400'
                }`}>
                  {country.risk_level}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
