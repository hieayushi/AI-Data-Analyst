import { NavLink } from 'react-router-dom'
import { MessageSquare, LayoutGrid, Upload, CheckCircle, AlertCircle } from 'lucide-react'

const NAV = [
  { to: '/',       icon: MessageSquare, label: 'Chat' },
  { to: '/schema', icon: LayoutGrid,    label: 'Data Explorer' },
]

export default function Sidebar({ isReady }) {
  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        background: 'var(--bg-2)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        position: 'sticky',
        top: 0,
        boxShadow: '1px 0 0 var(--border)',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'var(--accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
          </div>
          <div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>
              DataMind
            </p>
            <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 3, fontWeight: 500 }}>
              AI Data Analyst
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: '12px 10px', flex: 1 }}>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 11px',
              borderRadius: 9,
              marginBottom: 3,
              textDecoration: 'none',
              fontSize: 13,
              fontFamily: 'var(--font-body)',
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--accent)' : 'var(--text-2)',
              background: isActive ? 'var(--accent-light)' : 'transparent',
              border: isActive ? '1px solid rgba(99,102,241,0.15)' : '1px solid transparent',
              transition: 'all 0.15s',
            })}
          >
            {({ isActive }) => (
              <>
                <Icon size={15} style={{ color: isActive ? 'var(--accent)' : 'var(--text-3)' }} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Status — user-friendly only */}
      <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 11px', borderRadius: 9,
            background: isReady ? 'var(--green-light)' : 'var(--bg-3)',
            border: `1px solid ${isReady ? 'rgba(16,185,129,0.20)' : 'var(--border)'}`,
          }}
        >
          {isReady ? (
            <CheckCircle size={14} style={{ color: 'var(--green)', flexShrink: 0 }} />
          ) : (
            <AlertCircle size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          )}
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: isReady ? 'var(--green)' : 'var(--text-2)', lineHeight: 1.2 }}>
              {isReady ? 'Data ready' : 'No data loaded'}
            </p>
            <p style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
              {isReady ? 'Ready to query' : 'Upload a file to start'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
