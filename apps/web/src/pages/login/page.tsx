import { useState } from 'react'
import { redirect, useNavigate } from 'react-router-dom'
import { GitBranch } from 'lucide-react'
import { IconBox, Input, Button, Label } from '@eous/ui'
import { api, ApiError } from '../../lib/api.js'
import { useI18n } from '../../lib/i18n.js'

/* ── Loader: redirect to / if already authenticated ─── */
export async function loader() {
  try {
    await api.me()
    throw redirect('/')
  } catch (e) {
    if (e instanceof ApiError) return null
    throw e
  }
}

/* ── Page ────────────────────────────────────────────── */
export default function LoginPage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await api.login({ email, password })
      navigate('/', { replace: true })
    } catch {
      setError(t('login.invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Brand — top left */}
      <div className="flex items-center gap-2.5 px-6 py-5">
        <IconBox size="sm" className="border-primary bg-primary/10" interactive={false}>
          <GitBranch size={14} className="text-primary" />
        </IconBox>
        <span className="font-mono font-bold text-sm tracking-wide">EOUS</span>
      </div>

      {/* Center */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-sm border border-border rounded-sm p-6 space-y-6">
          <h1 className="text-lg font-semibold text-foreground">{t('login.title')}</h1>

          {/* Error line */}
          {error && (
            <div className="border-l-2 border-primary pl-3">
              <p className="font-mono text-xs text-primary">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground/60"
              >
                {t('login.email')}
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
              <Label
                htmlFor="password"
                className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground/60"
              >
                {t('login.password')}
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
              {loading ? t('login.submitting') : `-> ${t('login.submit')}`}
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
