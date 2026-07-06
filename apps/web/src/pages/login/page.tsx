import { useState, type FormEvent, type ReactNode } from 'react'
import { redirect, useNavigate } from 'react-router-dom'
import { ArrowRight, GitBranch, LockKeyhole, Mail, ShieldCheck, User } from 'lucide-react'
import { Input, Button, Label } from '@eous/ui'
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
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const isRegister = mode === 'register'

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode)
    setError('')
    setPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (isRegister && password !== confirmPassword) {
      setError(t('login.passwordMismatch'))
      return
    }

    setLoading(true)

    try {
      if (isRegister) {
        await api.register({ email, password, name })
      } else {
        await api.login({ email, password })
      }
      navigate('/', { replace: true })
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.status === 409) setError(t('login.emailExists'))
        else if (e.status === 403) setError(t('login.registrationDisabled'))
        else if (isRegister) setError(t('login.registerFailed'))
        else setError(t('login.invalidCredentials'))
      } else {
        setError(isRegister ? t('login.registerFailed') : t('login.invalidCredentials'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.34)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.3)_1px,transparent_1px)] bg-[size:44px_44px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 border-b border-primary/10 bg-primary/5" />

      <main className="relative z-10 flex min-h-screen w-full items-center justify-center px-4 py-6 sm:px-8">
        <section className="w-full max-w-md space-y-5">
          <BrandMark />

          <div className="w-full border border-border bg-card/95 shadow-[0_24px_80px_hsl(var(--foreground)/0.08)] backdrop-blur">
            <div className="space-y-6 p-5 sm:p-7">
              <div className="space-y-2">
                <p className="font-mono text-xs font-semibold uppercase text-primary">
                  {isRegister ? t('login.registerEyebrow') : t('login.signInEyebrow')}
                </p>
                <h2 className="text-2xl font-semibold">
                  {isRegister ? t('login.registerTitle') : t('login.title')}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {isRegister ? t('login.registerDescription') : t('login.description')}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-1 border border-border bg-muted/35 p-1">
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={`h-9 rounded-md font-mono text-xs transition-colors ${
                    !isRegister
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('login.submit')}
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className={`h-9 rounded-md font-mono text-xs transition-colors ${
                    isRegister
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('login.registerSubmit')}
                </button>
              </div>

              {error && (
                <div className="border border-primary/30 bg-primary/10 px-3 py-2">
                  <p className="font-mono text-xs text-primary">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {isRegister && (
                  <Field
                    id="name"
                    label={t('login.name')}
                    icon={<User size={15} />}
                    input={
                      <Input
                        id="name"
                        type="text"
                        placeholder={t('login.namePlaceholder')}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-11 border-0 pl-10 font-mono shadow-none focus-visible:ring-0"
                        autoFocus
                      />
                    }
                  />
                )}

                <Field
                  id="email"
                  label={t('login.email')}
                  icon={<Mail size={15} />}
                  input={
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-11 border-0 pl-10 font-mono shadow-none focus-visible:ring-0"
                      required
                      autoFocus={!isRegister}
                    />
                  }
                />

                <Field
                  id="password"
                  label={t('login.password')}
                  icon={<LockKeyhole size={15} />}
                  input={
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 border-0 pl-10 font-mono shadow-none focus-visible:ring-0"
                      required
                      minLength={8}
                    />
                  }
                />

                {isRegister && (
                  <Field
                    id="confirmPassword"
                    label={t('login.confirmPassword')}
                    icon={<ShieldCheck size={15} />}
                    input={
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="h-11 border-0 pl-10 font-mono shadow-none focus-visible:ring-0"
                        required
                        minLength={8}
                      />
                    }
                  />
                )}

                <Button
                  type="submit"
                  className="h-11 w-full justify-between rounded-md font-mono"
                  disabled={loading}
                >
                  <span>
                    {loading
                      ? isRegister
                        ? t('login.registering')
                        : t('login.submitting')
                      : isRegister
                        ? t('login.registerSubmit')
                        : t('login.submit')}
                  </span>
                  <ArrowRight size={15} />
                </Button>
              </form>
            </div>

            <p className="border-t border-border px-5 py-4 text-center font-mono text-[10px] uppercase text-muted-foreground/70">
              Eous TradingFlow
            </p>
          </div>
        </section>
      </main>
    </div>
  )
}

function BrandMark() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex size-16 items-center justify-center border border-border bg-card shadow-[0_18px_50px_hsl(var(--foreground)/0.08)]">
        <div className="absolute inset-1 border border-primary/20" />
        <div className="absolute left-1/2 top-0 h-2 w-px -translate-x-1/2 bg-primary" />
        <div className="absolute bottom-0 left-1/2 h-2 w-px -translate-x-1/2 bg-primary" />
        <GitBranch size={24} className="relative text-primary" />
      </div>
      <div className="text-center">
        <p className="font-mono text-base font-bold tracking-[0.32em] text-foreground">EOUS</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
          TradingFlow
        </p>
      </div>
    </div>
  )
}

function Field({
  id,
  label,
  icon,
  input,
}: {
  id: string
  label: string
  icon: ReactNode
  input: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground/70"
      >
        {label}
      </Label>
      <div className="relative rounded-md border border-input bg-background transition-colors focus-within:border-ring">
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </div>
        {input}
      </div>
    </div>
  )
}
