import '@eous/tailwind/globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { ThemeProvider, Toaster, TooltipProvider } from '@eous/ui'
import { router } from './router.js'
import { I18nProvider } from './lib/i18n.js'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="dark">
      <I18nProvider>
        <TooltipProvider delayDuration={2000}>
          <RouterProvider router={router} />
          <Toaster position="top-center" richColors />
        </TooltipProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
)
