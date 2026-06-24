import { Button, ResizableHandle, ResizablePanel, ResizablePanelGroup, cn } from '@eous/ui'
import { Eye, PanelLeftOpen } from 'lucide-react'
import { AgentViewPanel } from '../../../components/chat/agent-view-panel'
import { ChatComposer } from '../../../components/chat/chat-composer'
import { useChatController } from '../../../components/chat/hooks'
import { MessageList } from '../../../components/chat/message-list'
import { SessionList } from '../../../components/chat/session-list'
import {
  ChatStoreProvider,
  selectActiveAgent,
  selectActiveSession,
  selectSelectedAgent,
  useChatStore,
} from '../../../components/chat/store'

export default function AgentsPage() {
  return (
    <ChatStoreProvider>
      <ChatPageLayout />
    </ChatStoreProvider>
  )
}

function ChatPageLayout() {
  useChatController()

  const activeAgent = useChatStore(selectActiveAgent)
  const activeSession = useChatStore(selectActiveSession)
  const error = useChatStore((state) => state.error)
  const hasMessages = useChatStore((state) => state.messages.length > 0)
  const selectedAgent = useChatStore(selectSelectedAgent)
  const selectedModelId = useChatStore((state) => state.selectedModelId)
  const sessionListOpen = useChatStore((state) => state.sessionListOpen)
  const setSessionListOpen = useChatStore((state) => state.setSessionListOpen)
  const setViewOpen = useChatStore((state) => state.setViewOpen)
  const viewOpen = useChatStore((state) => state.viewOpen)

  return (
    <div className="h-[calc(100vh-72px)] overflow-hidden">
      <div
        className={cn(
          'grid h-full min-w-0',
          sessionListOpen ? 'grid-cols-[260px_minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)]',
        )}
      >
        {sessionListOpen ? <SessionList /> : null}

        <ResizablePanelGroup orientation="horizontal" className="min-w-0">
          <ResizablePanel defaultSize={viewOpen ? '74%' : '100%'} minSize="38%">
            <main className="flex h-full min-w-0 flex-col">
              <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
                <div className="flex min-w-0 items-center gap-2">
                  {!sessionListOpen ? (
                    <Button
                      size="sm"
                      variant="ghost-icon"
                      onClick={() => setSessionListOpen(true)}
                      title="Show sessions"
                    >
                      <PanelLeftOpen className="size-4" />
                    </Button>
                  ) : null}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {activeSession?.title ?? 'New conversation'}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {activeAgent?.name ?? selectedAgent?.name ?? 'Select an agent'}
                      {selectedModelId ? ` · ${selectedModelId}` : ''}
                    </div>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setViewOpen((open) => !open)}>
                  <Eye className="size-3.5" />
                  View
                </Button>
              </header>

              {error ? (
                <div className="border-b border-destructive/20 bg-destructive/10 px-5 py-2 text-xs text-destructive">
                  {error}
                </div>
              ) : null}

              <div className="flex min-h-0 flex-1 flex-col">
                <div
                  className={cn(
                    'min-h-0 flex-1 overflow-y-auto px-5 py-5',
                    !hasMessages && 'flex items-center justify-center',
                  )}
                >
                  {hasMessages ? <MessageList /> : null}
                </div>

                <ChatComposer />
              </div>
            </main>
          </ResizablePanel>

          {viewOpen ? (
            <>
              <ResizableHandle />
              <ResizablePanel
                defaultSize="26%"
                minSize="18%"
                maxSize="44%"
                className="min-w-[280px]"
              >
                <AgentViewPanel />
              </ResizablePanel>
            </>
          ) : null}
        </ResizablePanelGroup>
      </div>
    </div>
  )
}
