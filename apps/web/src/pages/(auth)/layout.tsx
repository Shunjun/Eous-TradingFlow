import { Outlet, useLoaderData, redirect } from 'react-router-dom'
import { ConsoleLayout } from '../../components/layout/console-layout.js'

/* ── Loader: enforce authentication ──────────────────── */
export async function loader() {
  const res = await fetch('/api/auth/me', { credentials: 'include' })
  if (!res.ok) throw redirect('/login')
  return res.json() as Promise<{ id: string; email: string; name: string }>
}

/* ── Layout ──────────────────────────────────────────── */
export default function AuthLayout() {
  const _user = useLoaderData() as { id: string; email: string; name: string }

  return (
    <ConsoleLayout>
      <Outlet />
    </ConsoleLayout>
  )
}
