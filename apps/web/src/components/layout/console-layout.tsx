import type { CSSProperties, ReactNode } from 'react'
import { SidebarProvider } from '@eous/ui'
import { AppSidebar } from './sidebar.js'
import { Header } from './header.js'

export function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider
      defaultOpen
      className="h-screen bg-background overflow-hidden"
      style={
        {
          '--sidebar-width': '14rem',
          '--sidebar-width-icon': '3.5rem',
        } as CSSProperties
      }
    >
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </SidebarProvider>
  )
}
