const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

async function get(path) {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`Failed ${path}`)
  return res.json()
}

export const apiV2 = {
  events: (params = '') => get(`/api/v2/events${params ? `?${params}` : ''}`),
  layers: () => get(`/api/v2/map/layers`),
  markets: (symbols = 'SPX,NQ,WTI,XAU,BTCUSD') => get(`/api/v2/markets?symbols=${symbols}`),
  cii: () => get(`/api/v2/cii`),
  alerts: () => get(`/api/v2/alerts`),
  correlation: () => get(`/api/v2/correlation`),
  sources: () => get(`/api/v2/sources`),
}
