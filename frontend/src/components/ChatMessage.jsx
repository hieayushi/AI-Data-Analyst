import { useState } from 'react'
import { User, Bot, AlertCircle, ChevronDown, ChevronUp, BarChart2, Table2, Sparkles } from 'lucide-react'
import SqlViewer from './SqlViewer'
import ResultTable from './ResultTable'
import DataChart from './DataChart'

/** Renders bold markdown (**text**) in the answer string */
function AnswerText({ text }) {
  if (!text) return null
  // Split on **...** markers
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <span>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} style={{ color: 'var(--text)', fontWeight: 700 }}>{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </span>
  )
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[
        { label: 'Understanding your question…',  delay: 0 },
        { label: 'Searching your data schema…',   delay: 0.35 },
        { label: 'Generating query…',             delay: 0.70 },
        { label: 'Fetching results…',             delay: 1.05 },
      ].map(({ label, delay }, i) => (
        <div
          key={i}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            opacity: 0, animation: `fadeIn 0.3s ease ${delay}s forwards`,
          }}
        >
          <div
            style={{
              width: 7, height: 7, borderRadius: '50%',
              background: 'var(--accent)',
              animation: `blink 1.4s step-end ${delay}s infinite`,
              flexShrink: 0,
            }}
          />
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--text-2)' }}>
            {label}
          </span>
        </div>
      ))}
      {/* shimmer rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
        {[100, 80, 60].map(w => (
          <div
            key={w}
            className="shimmer"
            style={{ height: 10, borderRadius: 6, width: `${w}%` }}
          />
        ))}
      </div>
    </div>
  )
}

export default function ChatMessage({ message }) {
  const {
    question, status, errorMsg, sql, explanation, answer,
    tablesUsed, assumptions, columns, rows, rowCount, truncated,
  } = message

  const [resultsOpen, setResultsOpen] = useState(true)
  const [viewMode, setViewMode] = useState('chart') // 'chart' | 'table'

  // Decide if chart view makes sense
  const hasChart = columns?.length >= 2 && rows?.length >= 2

  return (
    <div className="animate-slide-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── User question bubble ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, justifyContent: 'flex-end' }}>
        <div
          style={{
            borderRadius: '18px 18px 4px 18px',
            padding: '10px 16px',
            maxWidth: 520,
            background: 'var(--accent)',
            boxShadow: '0 2px 10px rgba(99,102,241,0.25)',
          }}
        >
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#fff', lineHeight: 1.55 }}>
            {question}
          </p>
        </div>
        <div
          style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: 'var(--bg-3)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <User size={15} style={{ color: 'var(--text-3)' }} />
        </div>
      </div>

      {/* ── AI response ───────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Avatar */}
        <div
          style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: 'var(--accent-light)',
            border: '1px solid rgba(99,102,241,0.20)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(99,102,241,0.12)',
          }}
        >
          <Bot size={15} style={{ color: 'var(--accent)' }} />
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* Loading */}
          {status === 'loading' && (
            <div
              style={{
                borderRadius: '4px 18px 18px 18px',
                padding: '14px 18px',
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <LoadingSkeleton />
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div
              style={{
                borderRadius: '4px 18px 18px 18px',
                padding: '14px 18px',
                background: 'var(--red-light)',
                border: '1px solid rgba(239,68,68,0.20)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <AlertCircle size={15} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 13, color: 'var(--red)', lineHeight: 1.6 }}>{errorMsg}</p>
              </div>
              {sql && <SqlViewer sql={sql} defaultOpen explanation="" tablesUsed={[]} />}
            </div>
          )}

          {/* Success */}
          {status === 'success' && (
            <>
              {/* Answer pill */}
              {answer && (
                <div
                  style={{
                    borderRadius: '4px 18px 18px 18px',
                    padding: '12px 18px',
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-sm)',
                    fontSize: 14,
                    color: 'var(--text-2)',
                    lineHeight: 1.6,
                  }}
                >
                  <AnswerText text={answer} />
                </div>
              )}

              {/* SQL viewer */}
              <SqlViewer
                sql={sql}
                explanation=""
                tablesUsed={tablesUsed}
                assumptions={assumptions}
                defaultOpen={false}
              />

              {/* Results panel */}
              {columns?.length > 0 && (
                <div
                  style={{
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {/* Panel header */}
                  <div
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 16px',
                      borderBottom: resultsOpen ? '1px solid var(--border)' : 'none',
                      cursor: 'pointer',
                    }}
                    onClick={() => setResultsOpen(v => !v)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
                        Results
                      </span>
                      <span className="badge badge-green" style={{ fontSize: 10 }}>
                        {rowCount} row{rowCount !== 1 ? 's' : ''}
                      </span>
                      {truncated && (
                        <span className="badge badge-orange" style={{ fontSize: 10 }}>Truncated at 1000</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {resultsOpen && hasChart && (
                        <div
                          style={{
                            display: 'flex', alignItems: 'center', gap: 2,
                            background: 'var(--bg-3)', borderRadius: 7, padding: 2,
                            border: '1px solid var(--border)',
                          }}
                          onClick={e => e.stopPropagation()}
                        >
                          {[
                            { mode: 'chart', Icon: BarChart2, tip: 'Chart' },
                            { mode: 'table', Icon: Table2,    tip: 'Table' },
                          ].map(({ mode, Icon, tip }) => (
                            <button
                              key={mode}
                              title={tip}
                              onClick={() => setViewMode(mode)}
                              style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: 26, height: 26, borderRadius: 5, border: 'none',
                                background: viewMode === mode ? 'var(--bg-2)' : 'transparent',
                                color: viewMode === mode ? 'var(--accent)' : 'var(--text-3)',
                                cursor: 'pointer',
                                boxShadow: viewMode === mode ? 'var(--shadow-sm)' : 'none',
                                transition: 'all 0.15s',
                              }}
                            >
                              <Icon size={13} />
                            </button>
                          ))}
                        </div>
                      )}
                      {resultsOpen
                        ? <ChevronUp size={14} style={{ color: 'var(--text-3)' }} />
                        : <ChevronDown size={14} style={{ color: 'var(--text-3)' }} />}
                    </div>
                  </div>

                  {resultsOpen && (
                    <div style={{ padding: '12px 14px' }} className="animate-fade-in">
                      {hasChart && viewMode === 'chart' ? (
                        <DataChart columns={columns} rows={rows} />
                      ) : (
                        <ResultTable
                          columns={columns}
                          rows={rows}
                          rowCount={rowCount}
                          truncated={truncated}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Empty result */}
              {columns?.length === 0 && (
                <div
                  style={{
                    borderRadius: '4px 18px 18px 18px',
                    padding: '12px 16px',
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
                    Query ran successfully — no rows returned.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
