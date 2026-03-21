import { useMemo } from 'react'

// Simplified world map country paths (key countries matching demo)
// Using approximate SVG paths for a 400x280 viewport
const COUNTRY_PATHS = {
  // Format: [svgPath, labelX, labelY]
  USA:  ['M 52,82 L 52,105 L 105,105 L 130,90 L 120,75 L 80,72 Z', 82, 92],
  CAN:  ['M 52,55 L 52,82 L 80,72 L 120,75 L 115,60 L 85,48 Z', 85, 65],
  MEX:  ['M 65,105 L 65,122 L 90,130 L 105,118 L 105,105 Z', 82, 114],
  BRA:  ['M 100,130 L 95,165 L 125,175 L 145,160 L 140,135 L 115,125 Z', 120, 152],
  VEN:  ['M 95,120 L 95,130 L 105,130 L 108,120 Z', 99, 125],
  GBR:  ['M 182,58 L 180,68 L 188,70 L 190,60 Z', 185, 64],
  FRA:  ['M 188,65 L 185,80 L 200,82 L 205,70 L 198,63 Z', 196, 73],
  DEU:  ['M 198,57 L 196,70 L 210,72 L 214,60 L 205,55 Z', 205, 64],
  RUS:  ['M 215,35 L 210,75 L 275,70 L 310,50 L 295,30 L 250,25 Z', 258, 52],
  UKR:  ['M 210,72 L 210,85 L 235,88 L 240,78 L 225,70 Z', 224, 80],
  TUR:  ['M 215,88 L 215,100 L 238,102 L 242,90 L 228,86 Z', 228, 95],
  SYR:  ['M 230,95 L 228,105 L 242,106 L 245,97 Z', 236, 101],
  LBN:  ['M 226,100 L 224,108 L 232,109 L 233,101 Z', 228, 105],
  ISR:  ['M 222,102 L 220,112 L 228,114 L 229,103 Z', 225, 108],
  SAU:  ['M 228,100 L 228,125 L 258,128 L 262,110 L 250,98 Z', 244, 114],
  IRN:  ['M 240,88 L 238,108 L 260,112 L 272,100 L 265,84 Z', 254, 100],
  PAK:  ['M 268,90 L 265,108 L 282,110 L 288,95 Z', 277, 100],
  IND:  ['M 272,100 L 270,130 L 295,138 L 302,118 L 290,100 Z', 284, 118],
  CHN:  ['M 290,55 L 285,100 L 320,105 L 340,88 L 335,58 L 310,50 Z', 312, 80],
  PRK:  ['M 330,65 L 328,78 L 340,80 L 345,68 Z', 336, 73],
  JPN:  ['M 342,65 L 340,82 L 352,84 L 355,68 Z', 347, 75],
  TWN:  ['M 326,90 L 324,100 L 333,102 L 335,92 Z', 329, 97],
  IDN:  ['M 305,138 L 302,148 L 335,152 L 338,142 L 318,135 Z', 318, 145],
  NGA:  ['M 192,130 L 190,150 L 210,153 L 215,133 Z', 202, 142],
  ETH:  ['M 230,130 L 228,148 L 248,150 L 250,132 Z', 239, 141],
  ZAF:  ['M 205,168 L 202,188 L 225,192 L 228,172 Z', 215, 180],
  AUS:  ['M 305,155 L 300,195 L 355,200 L 360,160 L 335,150 Z', 330, 178],
}

const RISK_COLORS = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#3b82f6',
  low:      '#22c55e',
  none:     '#1a2535',
}

export default function ChoroplethMap({ countries, onCountryClick, selectedCode }) {
  const countryMap = useMemo(() => {
    const m = {}
    countries.forEach(c => { m[c.code] = c })
    return m
  }, [countries])

  return (
    <svg viewBox="0 0 410 220" width="100%" height="100%"
      style={{ background: '#0a1628' }}>

      {/* Ocean background */}
      <rect width="410" height="220" fill="#0a1628" />

      {/* Grid lines */}
      {[55, 110, 165].map(y => (
        <line key={y} x1="0" y1={y} x2="410" y2={y}
          stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
      ))}
      {[82, 164, 246, 328].map(x => (
        <line key={x} x1={x} y1="0" x2={x} y2="220"
          stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
      ))}

      {/* Render all countries */}
      {Object.entries(COUNTRY_PATHS).map(([code, [path, lx, ly]]) => {
        const country = countryMap[code]
        const level   = country?.level ?? 'none'
        const color   = RISK_COLORS[level]
        const isSelected = code === selectedCode
        return (
          <g key={code} onClick={() => country && onCountryClick(country)}
            style={{ cursor: country ? 'pointer' : 'default' }}>
            <path
              d={path}
              fill={color}
              fillOpacity={isSelected ? 1 : 0.75}
              stroke={isSelected ? '#fff' : 'rgba(0,0,0,0.4)'}
              strokeWidth={isSelected ? 1.5 : 0.5}
              className="country-path"
            />
          </g>
        )
      })}

      {/* Equator line */}
      <line x1="0" y1="110" x2="410" y2="110"
        stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="4 4" />
    </svg>
  )
}
