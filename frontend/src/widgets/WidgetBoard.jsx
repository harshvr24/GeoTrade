import { renderWidget, defaultLayout } from './registry.jsx'

export default function WidgetBoard() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, padding: 12 }}>
      {defaultLayout.map(item => (
        <div key={item.i} style={{ minHeight: 180 }}>
          {renderWidget(item.i)}
        </div>
      ))}
    </div>
  )
}
