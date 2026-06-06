import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import SchemaPage from './pages/Schema'
import { useAnalyst } from './hooks/useAnalyst'

export default function App() {
  const {
    isReady,
    checkingReady,
    messages,
    isQuerying,
    sendQuestion,
    clearMessages,
    onUploadSuccess,
    checkReady,
  } = useAnalyst()

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <Sidebar isReady={isReady} />

      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route
            path="/"
            element={
              <Home
                isReady={isReady}
                checkingReady={checkingReady}
                messages={messages}
                isQuerying={isQuerying}
                onSend={sendQuestion}
                onClear={clearMessages}
                onUploadSuccess={onUploadSuccess}
              />
            }
          />
          <Route
            path="/schema"
            element={<SchemaPage isReady={isReady} />}
          />
        </Routes>
      </main>
    </div>
  )
}
