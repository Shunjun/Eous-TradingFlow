import { useMemo } from 'react'
import { Button, cn } from '@eous/ui'
import { MessageSquare, MessageSquarePlus, PanelLeftClose } from 'lucide-react'
import { formatChatTime } from './format-chat-time'
import { useChatStore } from './store'

export function SessionList() {
  const activeSessionId = useChatStore((state) => state.activeSessionId)
  const agents = useChatStore((state) => state.agents)
  const loading = useChatStore((state) => state.loading)
  const sessions = useChatStore((state) => state.sessions)
  const setActiveSessionId = useChatStore((state) => state.setActiveSessionId)
  const setSessionListOpen = useChatStore((state) => state.setSessionListOpen)
  const startNewConversation = useChatStore((state) => state.startNewConversation)

  const agentNameById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent.name])),
    [agents],
  )

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden border-r border-border">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-primary" />
          <div>
            <div className="text-sm font-semibold">Chat</div>
            <div className="text-xs text-muted-foreground">{sessions.length} sessions</div>
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost-icon"
          onClick={() => setSessionListOpen(false)}
          title="Hide sessions"
        >
          <PanelLeftClose className="size-4" />
        </Button>
      </div>
      <div className="border-b border-border p-2">
        <Button size="sm" variant="outline" className="w-full" onClick={startNewConversation}>
          <MessageSquarePlus className="size-3.5" />
          New conversation
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="p-3 text-xs text-muted-foreground">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <button
            className="w-full rounded-md border border-dashed border-border p-4 text-left text-sm text-muted-foreground hover:bg-muted/40"
            onClick={startNewConversation}
          >
            Start a new conversation
          </button>
        ) : (
          <div className="space-y-1">
            {sessions.map((session) => (
              <button
                key={session.id}
                className={cn(
                  'w-full rounded-md px-3 py-2 text-left transition-colors',
                  activeSessionId === session.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted',
                )}
                onClick={() => setActiveSessionId(session.id)}
              >
                <div className="truncate text-sm font-medium">{session.title}</div>
                <div
                  className={cn(
                    'mt-1 flex min-w-0 items-center justify-between gap-3 text-xs',
                    activeSessionId === session.id
                      ? 'text-primary-foreground/75'
                      : 'text-muted-foreground',
                  )}
                >
                  <span className="min-w-0 truncate">
                    {agentNameById.get(session.agentId) ?? 'Agent'}
                  </span>
                  <span className="shrink-0">{formatChatTime(session.updatedAt)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
