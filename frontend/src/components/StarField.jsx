import { useMemo } from 'react'

export default function StarField() {
  const stars = useMemo(
    () => Array.from({ length: 220 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      dur: `${2 + Math.random() * 5}s`,
      delay: `${Math.random() * 3}s`,
    })),
    []
  )

  return (
    <div className="starfield">
      {stars.map((s) => (
        <span key={s.id} className="star" style={{ left: s.left, top: s.top, animationDuration: s.dur, animationDelay: s.delay }} />
      ))}
    </div>
  )
}
