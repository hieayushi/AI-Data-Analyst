import { Database, RefreshCw } from 'lucide-react'
import SchemaViewer from '../components/SchemaViewer'
import { useState } from 'react'

export default function SchemaPage({ isReady }) {
  const [key, setKey] = useState(0) // remount SchemaViewer to force refresh

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-full">
        <div
          className="text-center rounded-2xl p-10 animate-fade-in"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', maxWidth: 360 }}
        >
          <Database size={32} style={{ color: 'var(--text-3)', margin: '0 auto 16px' }} />
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            No data loaded
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
            Upload a CSV or Excel file from the Chat page to see your schema here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-6">
      <div className="max-w-5xl mx-auto">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>
              Schema Explorer
            </h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3 }}>
              View table structures and edit AI-generated descriptions to improve SQL accuracy.
            </p>
          </div>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12 }}
            onClick={() => setKey(k => k + 1)}
          >
            <RefreshCw size={13} />
            Refresh
          </button>
        </div>

        {/* Info callout */}
        <div
          className="rounded-xl px-4 py-3 mb-5 flex items-start gap-3"
          style={{ background: 'var(--blue-glow)', border: '1px solid rgba(77,159,255,0.15)' }}
        >
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blue)', flexShrink: 0, marginTop: 5 }} />
          <p style={{ fontSize: 12, color: 'var(--blue)', lineHeight: 1.6 }}>
            Hover over any table or column description and click the{' '}
            <strong>edit icon</strong> to improve it. Better descriptions lead to more accurate SQL generation.
          </p>
        </div>

        <SchemaViewer key={key} />
      </div>
    </div>
  )
}
