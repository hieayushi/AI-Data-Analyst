import { useState, useEffect } from 'react'
import { Database, ChevronDown, ChevronRight, Edit2, Check, X, Loader } from 'lucide-react'
import { listTables, getTableDetail, updateTableDescription, extractError } from '../utils/api'

export default function SchemaViewer() {
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState({})
  const [tableDetails, setTableDetails] = useState({})
  const [loadingDetail, setLoadingDetail] = useState({})

  // editing state: { tableName: { field: 'table'|colName, value: '' } }
  const [editing, setEditing] = useState({})
  const [saving, setSaving] = useState({})

  useEffect(() => {
    setLoading(true)
    listTables()
      .then(setTables)
      .catch(e => setError(extractError(e)))
      .finally(() => setLoading(false))
  }, [])

  const toggleTable = async (name) => {
    setExpanded(prev => ({ ...prev, [name]: !prev[name] }))
    if (!tableDetails[name] && !expanded[name]) {
      setLoadingDetail(prev => ({ ...prev, [name]: true }))
      try {
        const detail = await getTableDetail(name)
        setTableDetails(prev => ({ ...prev, [name]: detail }))
      } catch { }
      finally { setLoadingDetail(prev => ({ ...prev, [name]: false })) }
    }
  }

  const startEdit = (tableName, field, currentValue) => {
    setEditing(prev => ({ ...prev, [tableName]: { field, value: currentValue || '' } }))
  }

  const cancelEdit = (tableName) => {
    setEditing(prev => { const n = { ...prev }; delete n[tableName]; return n })
  }

  const saveEdit = async (tableName) => {
    const { field, value } = editing[tableName]
    setSaving(prev => ({ ...prev, [tableName]: true }))
    try {
      const body = field === 'table'
        ? { table_description: value }
        : { column_descriptions: { [field]: value } }
      await updateTableDescription(tableName, body)
      // Update local state
      setTableDetails(prev => {
        const d = { ...prev[tableName] }
        if (field === 'table') d.description = value
        else d.columns = d.columns.map(c => c.name === field ? { ...c, description: value } : c)
        return { ...prev, [tableName]: d }
      })
      if (field === 'table') {
        setTables(prev => prev.map(t => t.name === tableName ? { ...t, description: value } : t))
      }
      cancelEdit(tableName)
    } catch { }
    finally { setSaving(prev => ({ ...prev, [tableName]: false })) }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-2" style={{ color: 'var(--text-3)' }}>
      <Loader size={16} className="animate-spin-slow" />
      <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>Loading schema…</span>
    </div>
  )

  if (error) return (
    <div className="rounded-xl p-4" style={{ background: 'var(--red-glow)', border: '1px solid rgba(255,95,95,0.2)' }}>
      <p style={{ fontSize: 13, color: 'var(--red)' }}>{error}</p>
    </div>
  )

  if (!tables.length) return (
    <div className="text-center py-16">
      <p style={{ fontSize: 13, color: 'var(--text-3)' }}>No schema found. Upload a file first.</p>
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1">
        <Database size={14} style={{ color: 'var(--accent)' }} />
        <span className="tag">{tables.length} table{tables.length !== 1 ? 's' : ''} in schema</span>
      </div>

      {tables.map(table => {
        const isOpen = expanded[table.name]
        const detail = tableDetails[table.name]
        const editState = editing[table.name]

        return (
          <div
            key={table.name}
            className="card overflow-hidden"
            style={{ border: isOpen ? '1px solid var(--border-bright)' : '1px solid var(--border)' }}
          >
            {/* Table header row */}
            <div
              className="flex items-start gap-3 px-4 py-3 cursor-pointer select-none"
              style={{ background: isOpen ? 'var(--bg-3)' : 'var(--bg-2)' }}
              onClick={() => toggleTable(table.name)}
            >
              <div style={{ marginTop: 2 }}>
                {isOpen
                  ? <ChevronDown size={14} style={{ color: 'var(--accent)' }} />
                  : <ChevronRight size={14} style={{ color: 'var(--text-3)' }} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {table.name}
                  </span>
                  <span className="badge badge-accent">{table.column_count} cols</span>
                  <span className="badge" style={{ background: 'var(--bg-4)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                    {table.row_count.toLocaleString()} rows
                  </span>
                </div>
                {/* Editable table description */}
                {editState?.field === 'table' ? (
                  <div className="flex items-center gap-2 mt-2" onClick={e => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={editState.value}
                      onChange={e => setEditing(prev => ({ ...prev, [table.name]: { ...prev[table.name], value: e.target.value } }))}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(table.name); if (e.key === 'Escape') cancelEdit(table.name) }}
                      style={{
                        flex: 1, background: 'var(--bg)', border: '1px solid var(--accent)',
                        borderRadius: 6, padding: '4px 8px', fontSize: 12,
                        color: 'var(--text)', fontFamily: 'var(--font-body)', outline: 'none',
                      }}
                    />
                    <button onClick={() => saveEdit(table.name)} disabled={saving[table.name]}>
                      {saving[table.name]
                        ? <Loader size={13} className="animate-spin-slow" style={{ color: 'var(--accent)' }} />
                        : <Check size={13} style={{ color: 'var(--green)' }} />}
                    </button>
                    <button onClick={() => cancelEdit(table.name)}>
                      <X size={13} style={{ color: 'var(--red)' }} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group mt-1">
                    <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>
                      {table.description || <em style={{ opacity: 0.5 }}>No description</em>}
                    </p>
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ flexShrink: 0 }}
                      onClick={e => { e.stopPropagation(); startEdit(table.name, 'table', table.description) }}
                    >
                      <Edit2 size={11} style={{ color: 'var(--text-3)' }} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Columns */}
            {isOpen && (
              <div className="animate-fade-in" style={{ borderTop: '1px solid var(--border)' }}>
                {loadingDetail[table.name] ? (
                  <div className="flex items-center gap-2 p-4" style={{ color: 'var(--text-3)' }}>
                    <Loader size={12} className="animate-spin-slow" />
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>Loading columns…</span>
                  </div>
                ) : detail?.columns?.length ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg)' }}>
                        {['Column', 'Type', 'Nullable', 'Description', 'Samples'].map(h => (
                          <th key={h} style={{
                            padding: '8px 12px', textAlign: 'left', fontSize: 10,
                            fontFamily: 'var(--font-display)', fontWeight: 700,
                            letterSpacing: '0.1em', textTransform: 'uppercase',
                            color: 'var(--text-3)', borderBottom: '1px solid var(--border)',
                            whiteSpace: 'nowrap',
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.columns.map((col, i) => {
                        const colEdit = editState?.field === col.name
                        return (
                          <tr
                            key={col.name}
                            style={{
                              background: i % 2 === 0 ? 'var(--bg-2)' : 'var(--bg)',
                              borderBottom: i < detail.columns.length - 1 ? '1px solid var(--border)' : 'none',
                            }}
                          >
                            <td style={{ padding: '8px 12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', whiteSpace: 'nowrap' }}>
                              {col.name}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <span className="badge badge-blue" style={{ fontSize: 10 }}>{col.type}</span>
                            </td>
                            <td style={{ padding: '8px 12px', fontSize: 11, fontFamily: 'var(--font-mono)', color: col.nullable ? 'var(--orange)' : 'var(--green)' }}>
                              {col.nullable ? 'yes' : 'no'}
                            </td>
                            <td style={{ padding: '8px 12px', maxWidth: 260 }}>
                              {colEdit ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    autoFocus
                                    value={editState.value}
                                    onChange={e => setEditing(prev => ({ ...prev, [table.name]: { ...prev[table.name], value: e.target.value } }))}
                                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(table.name); if (e.key === 'Escape') cancelEdit(table.name) }}
                                    style={{
                                      flex: 1, background: 'var(--bg)', border: '1px solid var(--accent)',
                                      borderRadius: 6, padding: '3px 7px', fontSize: 11,
                                      color: 'var(--text)', fontFamily: 'var(--font-body)', outline: 'none',
                                    }}
                                  />
                                  <button onClick={() => saveEdit(table.name)}>
                                    <Check size={12} style={{ color: 'var(--green)' }} />
                                  </button>
                                  <button onClick={() => cancelEdit(table.name)}>
                                    <X size={12} style={{ color: 'var(--red)' }} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1 group">
                                  <span style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.4 }}>
                                    {col.description || <em style={{ opacity: 0.4 }}>—</em>}
                                  </span>
                                  <button
                                    className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                    onClick={() => startEdit(table.name, col.name, col.description)}
                                  >
                                    <Edit2 size={10} style={{ color: 'var(--text-3)' }} />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px', maxWidth: 200, overflow: 'hidden' }}>
                              <div className="flex gap-1 flex-wrap">
                                {(col.sample_values || []).slice(0, 3).map((v, vi) => (
                                  <span
                                    key={vi}
                                    style={{
                                      background: 'var(--bg-4)', border: '1px solid var(--border)',
                                      borderRadius: 4, padding: '1px 5px', fontSize: 10,
                                      fontFamily: 'var(--font-mono)', color: 'var(--text-3)',
                                      maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap', display: 'inline-block',
                                    }}
                                    title={v}
                                  >
                                    {v}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)' }}>No column data available.</p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
