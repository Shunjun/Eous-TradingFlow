import { useCallback, useMemo, useState } from 'react'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
} from '@eous/ui'
import { MessageSquare, MessageSquarePlus, PanelLeftClose, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'
import { formatChatTime } from './format-chat-time'
import { useChatStore } from './store'

export function SessionList() {
  const activeSessionId = useChatStore((state) => state.activeSessionId)
  const agents = useChatStore((state) => state.agents)
  const isStreaming = useChatStore((state) => state.isStreaming)
  const loading = useChatStore((state) => state.loading)
  const setError = useChatStore((state) => state.setError)
  const setMessages = useChatStore((state) => state.setMessages)
  const sessions = useChatStore((state) => state.sessions)
  const setActiveSessionId = useChatStore((state) => state.setActiveSessionId)
  const setSessions = useChatStore((state) => state.setSessions)
  const setSessionListOpen = useChatStore((state) => state.setSessionListOpen)
  const startNewConversation = useChatStore((state) => state.startNewConversation)
  const streamingSessionId = useChatStore((state) => state.streamingSessionId)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const [deleting, setDeleting] = useState(false)

  const agentNameById = useMemo(
    () => new Map(agents.map((agent) => [agent.id, agent.name])),
    [agents],
  )

  const handleDeleteSession = useCallback(async () => {
    if (!deleteTarget) return

    setDeleting(true)
    setError(null)
    try {
      await api.deleteAgentSession(deleteTarget.id)
      setSessions((current) => current.filter((session) => session.id !== deleteTarget.id))
      if (activeSessionId === deleteTarget.id) {
        setActiveSessionId(null)
        setMessages([])
      }
      setDeleteTarget(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete session')
    } finally {
      setDeleting(false)
    }
  }, [activeSessionId, deleteTarget, setActiveSessionId, setError, setMessages, setSessions])

  return (
    <>
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
              {sessions.map((session) => {
                const isActive = activeSessionId === session.id
                const isStreamingSession = isStreaming && streamingSessionId === session.id

                return (
                  <div
                    key={session.id}
                    className={cn(
                      'group/session-item relative rounded-md transition-colors',
                      isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                    )}
                  >
                    <button
                      className={cn(
                        'w-full rounded-md px-3 py-2 pr-9 text-left',
                        isActive ? 'text-primary-foreground' : 'text-foreground',
                      )}
                      onClick={() => setActiveSessionId(session.id)}
                    >
                      <div className="truncate text-sm font-medium">{session.title}</div>
                      <div
                        className={cn(
                          'mt-1 flex min-w-0 items-center gap-1.5 text-xs',
                          isActive ? 'text-primary-foreground/75' : 'text-muted-foreground',
                        )}
                      >
                        <span className="min-w-0 truncate">
                          {agentNameById.get(session.agentId) ?? 'Agent'}
                        </span>
                        <span className="shrink-0">·</span>
                        <span className="shrink-0">{formatChatTime(session.updatedAt)}</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${session.title}`}
                      title={isStreamingSession ? 'Cannot delete while streaming' : 'Delete'}
                      disabled={isStreamingSession}
                      className={cn(
                        'absolute bottom-1.5 right-2 hidden size-5 items-center justify-center rounded-md opacity-0 transition focus:flex focus:opacity-100 group-hover/session-item:flex group-hover/session-item:opacity-100',
                        isActive
                          ? 'text-primary-foreground/70 hover:bg-primary-foreground/15 hover:text-primary-foreground'
                          : 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
                        isStreamingSession && 'cursor-not-allowed opacity-40 hover:bg-transparent',
                      )}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        setDeleteTarget({ id: session.id, title: session.title })
                      }}
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </aside>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent showCloseButton={!deleting}>
          <DialogHeader>
            <DialogTitle>Delete chat</DialogTitle>
            <DialogDescription>
              Delete "{deleteTarget?.title}"? This removes the conversation and its messages.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={handleDeleteSession}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
