export default function WidgetShell({ title, children }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 10, background: 'var(--bg2)', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)' }}>
        {title}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  )
}
