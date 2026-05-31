import { ThemeProvider } from '@eous/ui'
import { HomePage } from './pages/home.js'

export function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <HomePage />
    </ThemeProvider>
  )
}
