const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

async function get(path) {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`Failed ${path}`)
  return res.json()
}

export const apiV2 = {
  // Existing endpoints
  events: (params = '') => get(`/api/v2/events${params ? `?${params}` : ''}`),
  layers: () => get(`/api/v2/map/layers`),
  markets: (symbols = 'SPX,NQ,WTI,XAU,BTCUSD') => get(`/api/v2/markets?symbols=${symbols}`),
  cii: () => get(`/api/v2/cii`),
  ciiAll: () => get(`/api/v2/cii/all`),
  alerts: () => get(`/api/v2/alerts`),
  correlation: () => get(`/api/v2/correlation`),
  sources: () => get(`/api/v2/sources`),

  // New World Monitor intelligence endpoints
  brief: () => get(`/api/v2/brief`),
  focalPoints: () => get(`/api/v2/focal-points`),
  anomalies: () => get(`/api/v2/anomalies`),
  convergence: () => get(`/api/v2/convergence`),
  gaps: () => get(`/api/v2/gaps`),
  air: () => get(`/api/v2/intelligence/air`),
  sea: () => get(`/api/v2/intelligence/sea`),
  marketsLive: (symbols = 'SPX,NQ,WTI,XAU,BTCUSD,BRENT,NG,EURUSD,DXY,VIX') =>
    get(`/api/v2/markets/live?symbols=${symbols}`),
  signalsEnriched: () => get(`/api/v2/signals/enriched`),
}
