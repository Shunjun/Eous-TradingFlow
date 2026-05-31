import { useState, useEffect } from 'react'
import type { Quote } from '@eous/types'
import { ThemeProvider, useTheme, Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@eous/ui'
import { Moon, Sun } from 'lucide-react'

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      {theme === 'dark' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  )
}

function Dashboard() {
  const [serverStatus, setServerStatus] = useState<string>('checking...')
  const [quote, setQuote] = useState<Quote | null>(null)

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setServerStatus(d.status))
      .catch(() => setServerStatus('offline'))
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground p-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Eous TradingFlow</h1>
        <ThemeToggle />
      </div>

      <div className="grid gap-6 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>服务器状态</CardTitle>
            <CardDescription>后端连接检测</CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              Server: <strong>{serverStatus}</strong>
            </p>
            {quote && (
              <p className="mt-2">
                {quote.symbol}: ${quote.price}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>UI 组件库</CardTitle>
            <CardDescription>白天/夜间主题切换验证</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button>默认按钮</Button>
            <Button variant="secondary">次要</Button>
            <Button variant="destructive">危险</Button>
            <Button variant="outline">轮廓</Button>
            <Button variant="ghost">幽灵</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <Dashboard />
    </ThemeProvider>
  )
}
