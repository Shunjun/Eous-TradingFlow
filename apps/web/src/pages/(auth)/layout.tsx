import { Outlet, useLoaderData, redirect } from 'react-router-dom'
import { ConsoleLayout } from '../../components/layout/console-layout.js'
import { api, ApiError } from '../../lib/api.js'

/* ── Loader: enforce authentication ──────────────────── */
export async function loader() {
  try {
    return await api.me()
  } catch (e) {
    if (e instanceof ApiError) throw redirect('/login')
    throw e
  }
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
