import { useState, useEffect } from 'react'
import type { Quote } from '@eous/types'

export function App() {
  const [serverStatus, setServerStatus] = useState<string>('checking...')
  const [quote, setQuote] = useState<Quote | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setServerStatus(d.status))
      .catch(() => setServerStatus('offline'))
  }, [])

  return (
    <div style={{ padding: 40, fontFamily: 'system-ui' }}>
      <h1>Eous TradingFlow</h1>
      <p>
        Server: <strong>{serverStatus}</strong>
      </p>
      {quote && (
        <p>
          {quote.symbol}: ${quote.price}
        </p>
      )}
    </div>
  )
}
