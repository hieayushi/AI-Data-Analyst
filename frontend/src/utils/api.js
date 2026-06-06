import axios from 'axios'

const api = axios.create({
  baseURL: '/',
  timeout: 120000, // 2 min — embeddings + SQL gen can be slow
})

// ─── Upload ──────────────────────────────────────────────────────────────────

/** Upload CSV/Excel file. Returns { status, filename, tables_found, chunks_embedded, message } */
export async function uploadFile(file, onProgress) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/upload/', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: onProgress,
  })
  return data
}

/** Check if a file is uploaded and embeddings are ready */
export async function getUploadStatus() {
  const { data } = await api.get('/upload/status')
  return data
}

// ─── Query ────────────────────────────────────────────────────────────────────

/**
 * Run full NL→SQL→execute pipeline.
 * @param {string} question
 * @param {Array}  conversationHistory  [{role, content}]
 * @returns QueryResponse
 */
export async function runQuery(question, conversationHistory = []) {
  const { data } = await api.post('/query/', {
    question,
    conversation_history: conversationHistory,
    top_k: 8,
  })
  return data
}

/**
 * Generate SQL only (no execution).
 */
export async function generateSqlOnly(question, conversationHistory = []) {
  const { data } = await api.post('/query/sql-only', {
    question,
    conversation_history: conversationHistory,
    top_k: 8,
  })
  return data
}

// ─── Schema ───────────────────────────────────────────────────────────────────

/** Full schema JSON */
export async function getSchema() {
  const { data } = await api.get('/schema/')
  return data
}

/** Array of table summaries: { name, description, row_count, column_count } */
export async function listTables() {
  const { data } = await api.get('/schema/tables')
  return data
}

/** Single table detail: { name, description, columns, row_count } */
export async function getTableDetail(tableName) {
  const { data } = await api.get(`/schema/tables/${tableName}`)
  return data
}

/**
 * Update descriptions for a table or its columns.
 * @param {string} tableName
 * @param {{ table_description?, column_descriptions? }} body
 */
export async function updateTableDescription(tableName, body) {
  const { data } = await api.patch(`/schema/tables/${tableName}`, body)
  return data
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function healthCheck() {
  const { data } = await api.get('/health')
  return data
}

// ─── Error helpers ────────────────────────────────────────────────────────────

/** Extract a human-readable message from an axios error */
export function extractError(err) {
  if (err?.response?.data) {
    const d = err.response.data
    if (typeof d === 'string') return d
    if (d.detail) {
      if (typeof d.detail === 'string') return d.detail
      if (d.detail.message) return d.detail.message
      return JSON.stringify(d.detail)
    }
  }
  return err?.message || 'Unknown error'
}
