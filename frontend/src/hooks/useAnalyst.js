import { useState, useCallback, useEffect } from 'react'
import { getUploadStatus, runQuery, extractError } from '../utils/api'

/**
 * Central state hook for the AI Data Analyst app.
 * Manages: system readiness, chat history, query execution.
 */
export function useAnalyst() {
  const [isReady, setIsReady] = useState(false)         // file uploaded + embeddings stored
  const [checkingReady, setCheckingReady] = useState(true)
  const [qdrantInfo, setQdrantInfo] = useState(null)

  const [messages, setMessages] = useState([])           // chat messages
  const [isQuerying, setIsQuerying] = useState(false)
  const [queryError, setQueryError] = useState(null)

  // ── Check system readiness on mount ────────────────────────────────────────
  const checkReady = useCallback(async () => {
    setCheckingReady(true)
    try {
      const status = await getUploadStatus()
      setIsReady(!!status.ready)
      if (status.qdrant) setQdrantInfo(status.qdrant)
    } catch {
      setIsReady(false)
    } finally {
      setCheckingReady(false)
    }
  }, [])

  useEffect(() => { checkReady() }, [checkReady])

  // ── Send a question ─────────────────────────────────────────────────────────
  const sendQuestion = useCallback(async (question) => {
    if (!question.trim() || isQuerying) return

    setQueryError(null)

    // Build history for multi-turn context (last 6 turns)
    const history = messages
      .slice(-6)
      .flatMap(m => {
        const turns = [{ role: 'user', content: m.question }]
        if (m.sql) turns.push({ role: 'assistant', content: m.sql })
        return turns
      })

    // Optimistically add user message
    const msgId = Date.now()
    setMessages(prev => [
      ...prev,
      { id: msgId, question, status: 'loading', ts: new Date() },
    ])

    setIsQuerying(true)
    try {
      const result = await runQuery(question, history)
      setMessages(prev =>
        prev.map(m =>
          m.id === msgId
            ? { ...m, status: 'success', ...result }
            : m
        )
      )
    } catch (err) {
      const errMsg = extractError(err)
      // Try to extract SQL if backend returned it in the error body
      let sqlFromError = null
      if (err?.response?.data?.detail?.sql) sqlFromError = err.response.data.detail.sql

      setMessages(prev =>
        prev.map(m =>
          m.id === msgId
            ? { ...m, status: 'error', errorMsg: errMsg, sql: sqlFromError }
            : m
        )
      )
      setQueryError(errMsg)
    } finally {
      setIsQuerying(false)
    }
  }, [messages, isQuerying])

  const clearMessages = useCallback(() => setMessages([]), [])

  const onUploadSuccess = useCallback(() => {
    checkReady()
    clearMessages()
  }, [checkReady, clearMessages])

  return {
    isReady,
    checkingReady,
    qdrantInfo,
    messages,
    isQuerying,
    queryError,
    sendQuestion,
    clearMessages,
    onUploadSuccess,
    checkReady,
  }
}
