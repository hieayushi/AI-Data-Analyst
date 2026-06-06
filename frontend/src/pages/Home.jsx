import { useState } from 'react'
import { Upload, ChevronRight, ChevronLeft, Info } from 'lucide-react'
import FileUpload from '../components/FileUpload'
import ChatInterface from '../components/ChatInterface'

export default function Home({ isReady, messages, isQuerying, onSend, onClear, onUploadSuccess, checkingReady }) {
  const [uploadOpen, setUploadOpen] = useState(!isReady)

  // When file is successfully uploaded, collapse the upload panel
  const handleUploadSuccess = (result) => {
    onUploadSuccess?.(result)
    setUploadOpen(false)
  }

  if (checkingReady) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div
            style={{
              width: 36, height: 36, borderRadius: '50%',
              border: '2px solid var(--border)',
              borderTopColor: 'var(--accent)',
            }}
            className="animate-spin-slow"
          />
          <p style={{ fontSize: 13, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            Initialising…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Upload panel (collapsible) ── */}
      <div
        style={{
          width: uploadOpen ? 320 : 0,
          minWidth: uploadOpen ? 320 : 0,
          overflow: 'hidden',
          borderRight: uploadOpen ? '1px solid var(--border)' : 'none',
          background: 'var(--bg-2)',
          transition: 'all 0.25s ease',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {uploadOpen && (
          <div className="flex flex-col h-full animate-fade-in-l">
            <div
              className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Upload size={14} style={{ color: 'var(--accent)' }} />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                  Import Data
                </span>
              </div>
              <button
                style={{ color: 'var(--text-3)', padding: 4 }}
                onClick={() => setUploadOpen(false)}
              >
                <ChevronLeft size={15} />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 overflow-y-auto flex-1">
              <FileUpload onSuccess={handleUploadSuccess} />

              {/* Format guide */}
              <div
                className="rounded-xl p-4"
                style={{ background: 'var(--bg-3)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Info size={12} style={{ color: 'var(--blue)' }} />
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--blue)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Supported formats
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {[
                    { fmt: 'Excel (.xlsx)', desc: 'Each sheet → one table' },
                    { fmt: 'CSV (marker)', desc: '__table__ column separates tables' },
                    { fmt: 'CSV (blank rows)', desc: 'Blank lines separate sections' },
                  ].map(({ fmt, desc }) => (
                    <div key={fmt}>
                      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)' }}>{fmt}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)' }}>{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Toggle button ── */}
      {!uploadOpen && (
        <button
          onClick={() => setUploadOpen(true)}
          style={{
            width: 28, height: 28, borderRadius: '0 8px 8px 0',
            background: 'var(--bg-3)', border: '1px solid var(--border)',
            borderLeft: 'none', alignSelf: 'center', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-3)',
          }}
          title="Open upload panel"
        >
          <ChevronRight size={13} />
        </button>
      )}

      {/* ── Chat area ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full px-4 py-4 overflow-hidden">

        {/* Not-ready banner */}
        {!isReady && (
          <div
            className="rounded-xl px-4 py-3 mb-4 flex items-center gap-3 animate-slide-up"
            style={{ background: 'rgba(232,255,71,0.06)', border: '1px solid rgba(232,255,71,0.15)' }}
          >
            <div
              style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }}
              className="animate-blink"
            />
            <p style={{ fontSize: 13, color: 'var(--accent)', fontFamily: 'var(--font-body)' }}>
              Import a data file to start asking questions.
            </p>
            <button
              className="btn btn-primary"
              style={{ marginLeft: 'auto', padding: '5px 12px', fontSize: 12 }}
              onClick={() => setUploadOpen(true)}
            >
              Upload now
            </button>
          </div>
        )}

        <ChatInterface
          messages={messages}
          isQuerying={isQuerying}
          onSend={onSend}
          onClear={onClear}
          isReady={isReady}
        />
      </div>
    </div>
  )
}
