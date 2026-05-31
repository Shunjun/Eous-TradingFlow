import { useState } from 'react'
import { useNavigate, redirect } from 'react-router-dom'
import { GitBranch } from 'lucide-react'
import {
  IconBox,
  Input,
  Button,
  Label,
} from '@eous/ui'

/* ── Loader: redirect to / if already authenticated ─── */
export async function loader() {
  const res = await fetch('/api/auth/me', { credentials: 'include' })
  if (res.ok) throw redirect('/')
  return null
}

/* ── Page ────────────────────────────────────────────── */
export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })

      if (!res.ok) {
        setError('Invalid email or password')
        return
      }

      navigate('/', { replace: true })
    } catch {
      setError('Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Brand — top left */}
      <div className="flex items-center gap-2.5 px-6 py-5">
        <IconBox size="sm" className="border-[hsl(25,95%,53%)] bg-[hsl(25,95%,53%/0.1)]" interactive={false}>
          <GitBranch size={14} className="text-[hsl(25,95%,53%)]" />
        </IconBox>
        <span className="font-mono font-bold text-sm tracking-wide">EOUS</span>
      </div>

      {/* Center */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm border border-border rounded-sm p-6 space-y-6">
          <h1 className="text-lg font-semibold text-foreground">Sign in</h1>

          {/* Error line */}
          {error && (
            <div className="border-l-2 border-[hsl(25,95%,53%)] pl-3">
              <p className="font-mono text-xs text-[hsl(25,95%,53%)]">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground/60">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="font-mono"
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground/60">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-mono"
                required
                minLength={8}
              />
            </div>

            <hr className="border-border" />

            <Button
              type="submit"
              variant="accent-outline"
              className="w-full font-mono gap-2"
              disabled={loading}
            >
              {loading ? 'Signing in…' : '→ Sign in'}
            </Button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <p className="text-center font-mono text-[10px] text-muted-foreground/40 pb-6">
        Eous TradingFlow
      </p>
    </div>
  )
}
