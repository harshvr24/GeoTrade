import { useMemo } from 'react'

const RISK_COLORS = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#3b82f6',
  low: '#22c55e',
  none: '#1a2535',
}

// Simple equirectangular projection for flat map layout
const project = (lat, lng, width, height) => {
  const x = ((lng + 180) / 360) * width
  const y = ((90 - lat) / 180) * height
  return [x, y]
}

export default function ChoroplethMap({ countries, onCountryClick, selectedCode, marketHints = {} }) {
  const width = 420
  const height = 240

  const projected = useMemo(() => {
    return countries.map(c => {
      const [x, y] = project(c.lat || 0, c.lng || 0, width, height)
      return { ...c, x, y }
    })
  }, [countries])

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ background: '#0a1628' }}>
      {/* Subtle grid */}
      {[60, 120, 180].map(y => (
        <line key={`h-${y}`} x1="0" y1={y} x2={width} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      ))}
      {[80, 160, 240, 320].map(x => (
        <line key={`v-${x}`} x1={x} y1="0" x2={x} y2={height} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      ))}

      {projected.map(country => {
        const color = RISK_COLORS[country.level] || RISK_COLORS.none
        const isSelected = country.code === selectedCode
        const hint = marketHints[country.code] || {}
        return (
          <g key={country.code} onClick={() => onCountryClick && onCountryClick(country)} style={{ cursor: 'pointer' }}>
            <circle
              cx={country.x}
              cy={country.y}
              r={isSelected ? 12 : 9}
              fill={color}
              fillOpacity={isSelected ? 1 : 0.8}
              stroke={isSelected ? '#fff' : 'rgba(0,0,0,0.45)'}
              strokeWidth={isSelected ? 1.6 : 0.8}
            />
            <text
              x={country.x}
              y={country.y + 3}
              fontSize="8.5"
              textAnchor="middle"
              fill={isSelected ? '#fff' : 'rgba(255,255,255,0.85)'}
              style={{ fontWeight: 700, pointerEvents: 'none' }}
            >
              {country.code}
            </text>
            {hint.asset && (
              <text
                x={country.x}
                y={country.y + 13}
                fontSize="7.5"
                textAnchor="middle"
                fill="rgba(255,255,255,0.75)"
                style={{ pointerEvents: 'none' }}
              >
                {hint.asset}: {hint.price}{hint.change ? ` (${hint.change})` : ''}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
