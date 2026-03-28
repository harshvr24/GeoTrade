import WidgetShell from './widgetShell'
import RealTimeFeed from './widgets/RealTimeFeed'
import AlertsWidget from './widgets/AlertsWidget'
import MarketsMini from './widgets/MarketsMini'
import CiiMini from './widgets/CiiMini'

export const widgetRegistry = {
  feed: { id: 'feed', title: 'Real-Time Feed', component: RealTimeFeed },
  alerts: { id: 'alerts', title: 'Alerts', component: AlertsWidget },
  markets: { id: 'markets', title: 'Markets', component: MarketsMini },
  cii: { id: 'cii', title: 'CII', component: CiiMini },
}

export const defaultLayout = [
  { i: 'feed', x: 0, y: 0, w: 6, h: 8 },
  { i: 'alerts', x: 6, y: 0, w: 6, h: 4 },
  { i: 'markets', x: 6, y: 4, w: 3, h: 4 },
  { i: 'cii', x: 9, y: 4, w: 3, h: 4 },
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
