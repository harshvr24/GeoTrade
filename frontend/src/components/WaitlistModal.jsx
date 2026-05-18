import { useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export default function WaitlistModal({ onClose }) {
  const [email,   setEmail]   = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error()
      const json = await res.json()
      setSuccess(json.message || `${email} added to waitlist!`)
    } catch {
      // Demo fallback
      setSuccess(`${email} has been added to the GeoTrade waitlist. We'll be in touch!`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="waitlist-modal" style={{ position: 'relative' }}>
        <button className="modal-close" onClick={onClose}>✕</button>

        <div className="wl-icon">🧠</div>

        <div className="wl-title">Get Early Access</div>
        <div className="wl-sub">
          Join other professionals leveraging AI-driven geopolitical market intelligence.
        </div>

        {success ? (
          <div className="wl-success">{success}</div>
        ) : (
          <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              className="wl-input"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
            <button className="wl-btn" type="submit" disabled={loading}>
              {loading ? 'Joining...' : 'JOIN WAITLIST ✈'}
            </button>
          </form>
        )}

        <div className="wl-note">No spam. Unsubscribe at any time.</div>
      </div>
    </div>
  )
}
