import { useState, useRef, useEffect } from 'react'
import { Send, Trash2, Sparkles, ArrowUp } from 'lucide-react'
import ChatMessage from './ChatMessage'

const SUGGESTIONS = [
  'What are the total sales for this month?',
  'Show me the top 10 customers by revenue',
  'How many orders were placed last week?',
  'What is the average order value by category?',
  'List all products with stock below 20 units',
  'Which region has the highest sales growth?',
]

export default function ChatInterface({ messages, isQuerying, onSend, onClear, isReady }) {
  const [input, setInput] = useState('')
  const bottomRef  = useRef()
  const textareaRef = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const submit = () => {
    const q = input.trim()
    if (!q || isQuerying || !isReady) return
    onSend(q)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Messages area */}
      <div
        style={{
          flex: 1, overflowY: 'auto',
          padding: '24px 20px',
          display: 'flex', flexDirection: 'column', gap: 20,
        }}
      >
        {messages.length === 0 ? (
          <EmptyState onSuggest={(s) => { setInput(s); textareaRef.current?.focus() }} />
        ) : (
          <>
            {messages.map(msg => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* Input bar */}
      <div
        style={{
          borderTop: '1px solid var(--border)',
          padding: '12px 20px 16px',
          background: 'var(--bg-2)',
        }}
      >
        {messages.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button
              className="btn btn-ghost"
              style={{ padding: '4px 10px', fontSize: 11 }}
              onClick={onClear}
            >
              <Trash2 size={11} />
              Clear chat
            </button>
          </div>
        )}

        <div
          style={{
            display: 'flex', alignItems: 'flex-end', gap: 10,
            background: 'var(--bg)',
            border: `1.5px solid ${isQuerying ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 14,
            padding: '8px 8px 8px 16px',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            boxShadow: isQuerying ? '0 0 0 3px rgba(99,102,241,0.10)' : 'none',
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isReady
                ? 'Ask anything about your data…'
                : 'Upload a file to start asking questions'
            }
            disabled={!isReady || isQuerying}
            rows={1}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--text)',
              padding: '4px 0',
              maxHeight: 120,
              overflow: 'auto',
              lineHeight: 1.55,
            }}
            onInput={e => {
              e.target.style.height = 'auto'
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
            }}
          />
          <button
            className="btn btn-primary"
            style={{
              flexShrink: 0,
              borderRadius: 10,
              padding: '8px 14px',
              fontSize: 13,
              opacity: (!input.trim() || !isReady || isQuerying) ? 0.45 : 1,
            }}
            onClick={submit}
            disabled={!input.trim() || !isReady || isQuerying}
          >
            {isQuerying ? (
              <div
                style={{
                  width: 14, height: 14, borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.4)',
                  borderTopColor: '#fff',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
            ) : (
              <ArrowUp size={15} />
            )}
          </button>
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 7, textAlign: 'center' }}>
          Press <kbd style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-3)', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border)', fontSize: 10 }}>Enter</kbd> to send
          &nbsp;·&nbsp;
          <kbd style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-3)', padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border)', fontSize: 10 }}>Shift+Enter</kbd> for new line
        </p>
      </div>
    </div>
  )
}

function EmptyState({ onSuggest }) {
  return (
    <div
      style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        height: '100%', gap: 32, padding: '32px 16px',
      }}
    >
      {/* Hero icon */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
        <div
          style={{
            width: 60, height: 60, borderRadius: 18,
            background: 'var(--accent-light)',
            border: '1.5px solid rgba(99,102,241,0.20)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(99,102,241,0.15)',
          }}
        >
          <Sparkles size={26} style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>
            Ask your data anything
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-3)', marginTop: 6, maxWidth: 340 }}>
            Type a question in plain English and get instant charts & tables.
          </p>
        </div>
      </div>

      {/* Suggestions */}
      <div style={{ width: '100%', maxWidth: 560 }}>
        <p className="tag" style={{ textAlign: 'center', marginBottom: 12 }}>Try asking</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          {SUGGESTIONS.map(s => (
            <button
              key={s}
              onClick={() => onSuggest(s)}
              style={{
                background: 'var(--bg-2)',
                border: '1px solid var(--border)',
                borderRadius: 10,
                padding: '8px 14px',
                fontSize: 12,
                color: 'var(--text-2)',
                fontFamily: 'var(--font-body)',
                cursor: 'pointer',
                maxWidth: 240,
                textAlign: 'left',
                lineHeight: 1.4,
                transition: 'all 0.15s',
                boxShadow: 'var(--shadow-sm)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--accent-light)'
                e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)'
                e.currentTarget.style.color = 'var(--accent)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--bg-2)'
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color = 'var(--text-2)'
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
