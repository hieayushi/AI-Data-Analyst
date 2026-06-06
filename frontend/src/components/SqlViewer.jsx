import { useState } from 'react'
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react'

const KEYWORDS = [
  'SELECT','FROM','WHERE','JOIN','LEFT','RIGHT','INNER','OUTER','FULL','CROSS',
  'ON','GROUP BY','ORDER BY','HAVING','LIMIT','OFFSET','UNION','ALL','DISTINCT',
  'AS','AND','OR','NOT','IN','EXISTS','BETWEEN','LIKE','IS','NULL','WITH','CTE',
  'INSERT','UPDATE','DELETE','CREATE','DROP','ALTER','TABLE','INDEX',
  'COUNT','SUM','AVG','MIN','MAX','COALESCE','NULLIF','CASE','WHEN','THEN','ELSE',
  'END','DATE_TRUNC','CURRENT_DATE','INTERVAL','CAST','BY','ASC','DESC',
  'INTO','SET','VALUES','RETURNING',
]

function highlightSQL(sql) {
  if (!sql) return ''
  let result = sql
    // Strings
    .replace(/('(?:[^'\\]|\\.)*')/g, '<span style="color:#3ddc97">$1</span>')
    // Numbers
    .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span style="color:#ff9f43">$1</span>')
    // Comments
    .replace(/(--[^\n]*)/g, '<span style="color:#5a5a72">$1</span>')

  // Keywords (case-insensitive, whole word)
  KEYWORDS.forEach(kw => {
    const re = new RegExp(`\\b(${kw})\\b`, 'gi')
    result = result.replace(re, '<span style="color:#4d9fff;font-weight:600">$1</span>')
  })

  return result
}

export default function SqlViewer({ sql, explanation, tablesUsed, assumptions, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(sql || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  if (!sql) return null

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none"
        style={{ background: 'var(--bg-3)', borderBottom: open ? '1px solid var(--border)' : 'none' }}
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <span
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--accent)', display: 'inline-block',
              boxShadow: '0 0 6px var(--accent)',
            }}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-2)', letterSpacing: '0.05em' }}>
            GENERATED SQL
          </span>
          {tablesUsed?.length > 0 && (
            <div className="flex gap-1 ml-1">
              {tablesUsed.map(t => (
                <span key={t} className="badge badge-blue" style={{ fontSize: 10 }}>{t}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn btn-ghost"
            style={{ padding: '3px 8px', fontSize: 11 }}
            onClick={(e) => { e.stopPropagation(); copy() }}
          >
            {copied ? <Check size={12} style={{ color: 'var(--green)' }} /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          {open
            ? <ChevronUp size={14} style={{ color: 'var(--text-3)' }} />
            : <ChevronDown size={14} style={{ color: 'var(--text-3)' }} />}
        </div>
      </div>

      {/* Body */}
      {open && (
        <div className="animate-fade-in">
          {/* SQL block */}
          <div
            className="sql-block"
            dangerouslySetInnerHTML={{ __html: highlightSQL(sql) }}
            style={{ borderRadius: 0, border: 'none', borderBottom: explanation || assumptions ? '1px solid var(--border)' : 'none' }}
          />

          {/* Explanation + assumptions */}
          {(explanation || assumptions) && (
            <div className="px-4 py-3 flex flex-col gap-2">
              {explanation && (
                <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}>
                  <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-mono)', fontSize: 10, marginRight: 6 }}>
                    WHAT IT DOES
                  </span>
                  {explanation}
                </p>
              )}
              {assumptions && assumptions !== 'null' && (
                <p style={{ fontSize: 12, color: 'var(--orange)', lineHeight: 1.6 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, marginRight: 6, opacity: 0.7 }}>
                    ASSUMPTIONS
                  </span>
                  {assumptions}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
