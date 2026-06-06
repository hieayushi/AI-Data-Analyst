import { useState } from 'react'
import { Download, AlertTriangle } from 'lucide-react'

export default function ResultTable({ columns, rows, rowCount, truncated }) {
  const [filter, setFilter] = useState('')

  if (!columns?.length) return null

  // Client-side filter across all cells
  const filtered = filter.trim()
    ? rows.filter(row =>
        row.some(cell =>
          String(cell ?? '').toLowerCase().includes(filter.toLowerCase())
        )
      )
    : rows

  const exportCSV = () => {
    const header = columns.join(',')
    const body = rows.map(r =>
      r.map(v => {
        const s = String(v ?? '')
        return s.includes(',') || s.includes('"') || s.includes('\n')
          ? `"${s.replace(/"/g, '""')}"`
          : s
      }).join(',')
    ).join('\n')
    const blob = new Blob([header + '\n' + body], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'result.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)' }}>
            {filtered.length !== rows.length
              ? `${filtered.length} of ${rowCount} rows`
              : `${rowCount} row${rowCount !== 1 ? 's' : ''}`}
          </span>
          {truncated && (
            <span className="badge badge-orange">
              <AlertTriangle size={9} />
              Truncated at 1000
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {rows.length > 6 && (
            <input
              type="text"
              placeholder="Filter results…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '4px 10px',
                fontSize: 12,
                color: 'var(--text)',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
                width: 160,
                transition: 'border-color 0.15s',
              }}
            />
          )}
          <button
            className="btn btn-ghost"
            style={{ padding: '4px 10px', fontSize: 11 }}
            onClick={exportCSV}
          >
            <Download size={12} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="result-table-wrap">
        <table className="result-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th key={col}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-3)' }}>
                  No rows match the filter.
                </td>
              </tr>
            ) : (
              filtered.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} title={String(cell ?? '')}>
                      {cell === null || cell === undefined
                        ? <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>null</span>
                        : String(cell)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
