import { useEffect, useMemo, useState } from 'react'
import Globe from 'react-globe.gl'
import StarField from './components/StarField'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

const colorForRisk = (score) => {
  if (score >= 80) return '#ef4444'
  if (score >= 60) return '#f97316'
  if (score >= 35) return '#3b82f6'
  return '#22c55e'
}

export default function App() {
  const [data, setData] = useState({ gti: 0, countries: [], events: [], signals: [], last_updated: '' })
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    let timer
    const load = async () => {
      const res = await fetch(`${API_BASE}/api/dashboard`)
      const json = await res.json()
      setData(json)
    }
    load()
    timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [])

  const points = useMemo(
    () => data.countries.map((c, idx) => ({
      ...c,
      lat: 55 - idx * 14,
      lng: -130 + idx * 36,
      size: Math.max(0.35, c.risk_score / 130),
      color: colorForRisk(c.risk_score),
    })),
    [data.countries]
  )

  return (
    <main className="app">
      <StarField />
      <header className="panel header">
        <h1>GeoTrade Intelligence</h1>
        <div>Global Tension Index: <strong>{data.gti}</strong></div>
        <small>{new Date(data.last_updated || Date.now()).toLocaleTimeString()}</small>
      </header>

      <section className="content">
        <div className="globe-wrap panel">
          <Globe
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
            bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
            backgroundColor="rgba(0,0,0,0)"
            pointsData={points}
            pointColor="color"
            pointAltitude="size"
            pointRadius={0.38}
            pointLabel={(d) => `${d.country_name}: ${d.risk_score}`}
            onPointClick={(d) => setSelected(d)}
            arcsData={data.events.slice(0, 8).map((e, i) => ({
              startLat: points[i % Math.max(1, points.length)]?.lat ?? 0,
              startLng: points[i % Math.max(1, points.length)]?.lng ?? 0,
              endLat: 0,
              endLng: 20,
              color: [colorForRisk(e.risk_score), '#22d3ee'],
            }))}
            arcDashLength={0.4}
            arcDashGap={2}
            arcDashAnimateTime={1300}
          />
          {selected && (
            <div className="modal panel">
              <h3>{selected.country_name}</h3>
              <p>Risk score: {selected.risk_score}</p>
              <button onClick={() => setSelected(null)}>Close</button>
            </div>
          )}
        </div>

        <aside className="panel signals">
          <h2>AI Signals</h2>
          {data.signals.map((s) => (
            <article key={s.asset} className="signal-card">
              <h3>{s.asset}</h3>
              <p>{s.bias} · {Math.round(s.confidence * 100)}%</p>
              <small>{s.rationale}</small>
            </article>
          ))}
        </aside>
      </section>

      <footer className="panel timeline">
        <h2>Event Timeline</h2>
        <div className="event-list">
          {data.events.map((e) => (
            <article key={e.id} className="event-item">
              <strong>{e.country_name}</strong> · <span className={`sev ${e.severity}`}>{e.severity}</span>
              <p>{e.headline}</p>
              <small>{e.market_impact}</small>
            </article>
          ))}
        </div>
      </footer>
    </main>
  )
}
