import { useState, useRef, useCallback } from 'react'
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader, X } from 'lucide-react'
import { uploadFile, extractError } from '../utils/api'

export default function FileUpload({ onSuccess }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('') // 'uploading' | 'processing' | 'embedding'
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const inputRef = useRef()

  const handleFile = useCallback(async (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setError('Only .csv, .xlsx, .xls files are supported.')
      return
    }

    setError(null)
    setResult(null)
    setUploading(true)
    setStage('uploading')
    setProgress(0)

    try {
      // Simulate multi-stage progress
      const res = await uploadFile(file, (ev) => {
        const pct = Math.round((ev.loaded / ev.total) * 40)
        setProgress(pct)
        if (pct >= 40) {
          setStage('processing')
          // Animate remaining progress during server processing
          let p = 40
          const interval = setInterval(() => {
            p = Math.min(p + 2, 85)
            setProgress(p)
            if (p >= 60) setStage('embedding')
            if (p >= 85) clearInterval(interval)
          }, 300)
        }
      })

      setProgress(100)
      setStage('done')
      setResult(res)
      onSuccess?.(res)
    } catch (err) {
      setError(extractError(err))
    } finally {
      setUploading(false)
    }
  }, [onSuccess])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    handleFile(file)
  }, [handleFile])

  const onDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  const stageLabel = {
    uploading:  'Uploading your file…',
    processing: 'Analysing data structure…',
    embedding:  'Preparing data for queries…',
    done:       'Ready to query!',
  }[stage] || ''

  return (
    <div className="w-full">
      {/* Drop zone */}
      {!result && (
        <div
          onClick={() => !uploading && inputRef.current?.click()}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className="relative overflow-hidden cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200"
          style={{
            borderColor: dragging ? 'var(--accent)' : uploading ? 'var(--border-bright)' : 'var(--border)',
            background: dragging ? 'var(--accent-glow)' : 'var(--bg-2)',
            padding: '40px 32px',
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => handleFile(e.target.files[0])}
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-5 animate-fade-in">
              <div className="relative">
                <div
                  className="animate-spin-slow"
                  style={{
                    width: 48, height: 48,
                    borderRadius: '50%',
                    border: '2px solid var(--border)',
                    borderTopColor: 'var(--accent)',
                  }}
                />
                <FileSpreadsheet
                  size={18}
                  style={{ position: 'absolute', inset: 0, margin: 'auto', color: 'var(--accent)' }}
                />
              </div>

              <div className="w-full max-w-sm flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-2)' }}>
                    {stageLabel}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>
                    {progress}%
                  </span>
                </div>
                <div style={{ height: 4, borderRadius: 99, background: 'var(--bg-3)', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${progress}%`,
                      background: 'var(--accent)',
                      borderRadius: 99,
                      transition: 'width 0.4s ease',
                      boxShadow: '0 0 12px var(--accent)',
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-center">
              <div
                style={{
                  width: 56, height: 56, borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-3)',
                  border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Upload size={22} style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                  Drop your data file here
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
                  CSV or Excel · Up to 8 tables · Auto-detects structure
                </p>
              </div>
              <div className="flex gap-2">
                {['.csv', '.xlsx', '.xls'].map(ext => (
                  <span key={ext} className="badge badge-accent">{ext}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="animate-slide-up mt-3 flex items-start gap-3 rounded-xl p-4"
          style={{ background: 'var(--red-glow)', border: '1px solid rgba(255,95,95,0.2)' }}
        >
          <AlertCircle size={16} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 13, color: 'var(--red)', lineHeight: 1.5 }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ marginLeft: 'auto', color: 'var(--red)', opacity: 0.6 }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Success */}
      {result && (
        <div
          className="animate-slide-up rounded-2xl p-5"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-start gap-3">
            <CheckCircle size={18} style={{ color: 'var(--green)', flexShrink: 0, marginTop: 1 }} />
            <div className="flex-1 min-w-0">
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>
                {result.filename}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                {result.message}
              </p>
            </div>
          </div>
          <div className="flex gap-3 mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <Stat label="Tables found" value={result.tables_found} color="var(--accent)" />
            <Stat label="Columns indexed" value={result.chunks_embedded} color="var(--blue)" />
          </div>
          <button
            className="btn btn-ghost w-full mt-3"
            style={{ justifyContent: 'center', fontSize: 12 }}
            onClick={() => { setResult(null); setProgress(0) }}
          >
            Upload a different file
          </button>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, color }) {
  return (
    <div
      className="flex-1 rounded-xl p-3 flex flex-col gap-1"
      style={{ background: 'var(--bg-3)' }}
    >
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color }}>
        {value}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
    </div>
  )
}
