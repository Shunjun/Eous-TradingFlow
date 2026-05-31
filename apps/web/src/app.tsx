import { ThemeProvider } from '@eous/ui'
import { ConsoleLayout } from './components/layout/console-layout.js'
import { DashboardPage } from './pages/dashboard.js'

export function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <ConsoleLayout>
        <DashboardPage />
      </ConsoleLayout>
    </ThemeProvider>
  )
}
