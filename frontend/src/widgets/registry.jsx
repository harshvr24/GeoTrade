import WidgetShell from './widgetShell'
import RealTimeFeed from './widgets/RealTimeFeed'
import AlertsWidget from './widgets/AlertsWidget'
import MarketsMini from './widgets/MarketsMini'
import CiiMini from './widgets/CiiMini'
import BriefWidget from './widgets/BriefWidget'
import AnomalyWidget from './widgets/AnomalyWidget'
import CoverageWidget from './widgets/CoverageWidget'

export const widgetRegistry = {
  feed: { id: 'feed', title: 'Real-Time Feed', component: RealTimeFeed },
  alerts: { id: 'alerts', title: 'Alerts', component: AlertsWidget },
  markets: { id: 'markets', title: 'Markets', component: MarketsMini },
  cii: { id: 'cii', title: 'CII', component: CiiMini },
  brief: { id: 'brief', title: 'World Brief', component: BriefWidget },
  anomaly: { id: 'anomaly', title: 'Anomalies', component: AnomalyWidget },
  coverage: { id: 'coverage', title: 'Coverage', component: CoverageWidget },
}

export const defaultLayout = [
  { i: 'feed',     x: 0, y: 0, w: 6, h: 8 },
  { i: 'alerts',   x: 6, y: 0, w: 6, h: 4 },
  { i: 'markets',  x: 6, y: 4, w: 3, h: 4 },
  { i: 'cii',      x: 9, y: 4, w: 3, h: 4 },
  { i: 'brief',    x: 0, y: 8, w: 6, h: 5 },
  { i: 'anomaly',  x: 6, y: 8, w: 6, h: 5 },
  { i: 'coverage',  x: 0, y: 13, w: 4, h: 4 },
]

export function renderWidget(id, props) {
  const def = widgetRegistry[id]
  if (!def) return null
  const Comp = def.component
  return (
    <WidgetShell title={def.title}>
      <Comp {...props} />
    </WidgetShell>
  )
}
