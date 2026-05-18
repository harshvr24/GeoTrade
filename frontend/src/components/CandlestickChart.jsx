import { useMemo } from 'react'

export default function CandlestickChart({ candles, width = 600, height = 300 }) {
  const { paths, xLabels, yLabels, priceLines } = useMemo(() => {
    if (!candles || candles.length === 0) return { paths: [], xLabels: [], yLabels: [], priceLines: [] }

    const padL = 52, padR = 12, padT = 12, padB = 28
    const w = width  - padL - padR
    const h = height - padT - padB

    const allPrices = candles.flatMap(c => [c.high, c.low])
    const minP = Math.min(...allPrices)
    const maxP = Math.max(...allPrices)
    const range = maxP - minP || 1

    const toX = i  => padL + (i / (candles.length - 1)) * w
    const toY = p  => padT + h - ((p - minP) / range) * h

    const candleW = Math.max(2, w / candles.length * 0.6)

    const paths = candles.map((c, i) => {
      const x   = toX(i)
      const oY  = toY(c.open)
      const cY  = toY(c.close)
      const hY  = toY(c.high)
      const lY  = toY(c.low)
      const bull = c.close >= c.open
      const bodyH = Math.max(1, Math.abs(cY - oY))
      return {
        i, x, oY, cY, hY, lY, bull, bodyH, candleW,
        bodyY: Math.min(oY, cY),
        color: bull ? '#00e676' : '#ff4444',
      }
    })

    // x-axis labels every ~10 candles
    const step = Math.ceil(candles.length / 8)
    const xLabels = candles
      .filter((_, i) => i % step === 0 || i === candles.length - 1)
      .map((c, _, arr) => {
        const idx = candles.indexOf(c)
        const hr  = 8 + Math.floor(idx * 10 / 60)
        const min = (idx * 10) % 60
        return { x: toX(idx), label: `${String(hr).padStart(2,'0')}:${String(min).padStart(2,'0')}` }
      })

    // y-axis labels
    const steps = 5
    const yLabels = Array.from({ length: steps + 1 }, (_, i) => {
      const p = minP + (range * i / steps)
      return { y: toY(p), label: p > 1000 ? p.toFixed(0) : p.toFixed(2) }
    })

    // current price line
    const lastClose = candles[candles.length - 1].close
    const priceLines = [{ y: toY(lastClose), price: lastClose > 1000 ? lastClose.toFixed(2) : lastClose.toFixed(3) }]

    return { paths, xLabels, yLabels, priceLines }
  }, [candles, width, height])

  if (!candles || candles.length === 0) return null

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {/* grid lines */}
      {yLabels.map((l, i) => (
        <line key={i} x1={52} x2={width - 12} y1={l.y} y2={l.y}
          stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
      ))}

      {/* candles */}
      {paths.map(c => (
        <g key={c.i}>
          {/* wick */}
          <line x1={c.x} x2={c.x} y1={c.hY} y2={c.lY}
            stroke={c.color} strokeWidth={1} opacity={0.7} />
          {/* body */}
          <rect
            x={c.x - c.candleW / 2}
            y={c.bodyY}
            width={c.candleW}
            height={c.bodyH}
            fill={c.color}
            opacity={0.9}
          />
        </g>
      ))}

      {/* current price line */}
      {priceLines.map((pl, i) => (
        <g key={i}>
          <line x1={52} x2={width - 12} y1={pl.y} y2={pl.y}
            stroke="rgba(0,212,255,0.5)" strokeWidth={1} strokeDasharray="4 3" />
          <rect x={width - 60} y={pl.y - 9} width={50} height={18} rx={3}
            fill="rgba(0,212,255,0.2)" />
          <text x={width - 35} y={pl.y + 4}
            fill="#00d4ff" fontSize={10} textAnchor="middle"
            fontFamily="JetBrains Mono, monospace">
            {pl.price}
          </text>
        </g>
      ))}

      {/* y-axis labels */}
      {yLabels.map((l, i) => (
        <text key={i} x={48} y={l.y + 4}
          fill="rgba(90,122,154,0.9)" fontSize={9}
          textAnchor="end" fontFamily="JetBrains Mono, monospace">
          {l.label}
        </text>
      ))}

      {/* x-axis labels */}
      {xLabels.map((l, i) => (
        <text key={i} x={l.x} y={height - 6}
          fill="rgba(90,122,154,0.9)" fontSize={9}
          textAnchor="middle" fontFamily="JetBrains Mono, monospace">
          {l.label}
        </text>
      ))}
    </svg>
  )
}
