import { useLayoutEffect, type RefObject } from 'react'
import { cn } from '@eous/ui'
import { Wrench } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { AgentMessage } from '@eous/api-client'
import { formatChatTime } from './format-chat-time'
import { useChatStore } from './store'

function getToolMeta(message: AgentMessage): Record<string, unknown> | null {
  const metadata = message.metadata
  const tool = metadata.tool ?? metadata.toolCall ?? metadata.toolResult
  return tool && typeof tool === 'object' && !Array.isArray(tool)
    ? (tool as Record<string, unknown>)
    : null
}

function ToolBlock({ message }: { message: AgentMessage }) {
  const tool = getToolMeta(message)
  if (!tool && message.role !== 'tool') return null

  const name = String(tool?.name ?? tool?.toolName ?? 'Tool call')
  const status = String(tool?.status ?? (message.role === 'tool' ? 'result' : 'running'))

  return (
    <div className="mb-2 rounded-md border border-border bg-background/70 p-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 font-medium">
          <Wrench className="size-3.5 shrink-0" />
          <span className="truncate">{name}</span>
        </div>
        <span className="shrink-0 text-muted-foreground">{status}</span>
      </div>
      {tool?.args ? (
        <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted/50 p-2 text-[11px] leading-4">
          {JSON.stringify(tool.args, null, 2)}
        </pre>
      ) : null}
    </div>
  )
}

function MessageContent({ message }: { message: AgentMessage }) {
  if (message.role === 'user') {
    return <div className="whitespace-pre-wrap">{message.content || '...'}</div>
  }

  return (
    <>
      <ToolBlock message={message} />
      <div className="space-y-2">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ children, ...props }) => (
              <a {...props} className="underline underline-offset-2">
                {children}
              </a>
            ),
            code: ({ children, className, ...props }) => {
              const isBlock = typeof className === 'string' && className.includes('language-')
              if (isBlock) {
                return (
                  <code
                    {...props}
                    className="block overflow-auto rounded-md bg-background/80 p-3 text-xs leading-5"
                  >
                    {children}
                  </code>
                )
              }
              return (
                <code {...props} className="rounded bg-background/80 px-1">
                  {children}
                </code>
              )
            },
            ol: ({ children, ...props }) => (
              <ol {...props} className="list-decimal pl-5">
                {children}
              </ol>
            ),
            ul: ({ children, ...props }) => (
              <ul {...props} className="list-disc pl-5">
                {children}
              </ul>
            ),
            pre: ({ children, ...props }) => (
              <pre {...props} className="overflow-auto rounded-md bg-background/80 p-3">
                {children}
              </pre>
            ),
            table: ({ children, ...props }) => (
              <div className="max-w-full overflow-x-auto rounded-md border border-border">
                <table {...props} className="w-full border-collapse text-sm">
                  {children}
                </table>
              </div>
            ),
            thead: ({ children, ...props }) => <thead {...props}>{children}</thead>,
            tbody: ({ children, ...props }) => <tbody {...props}>{children}</tbody>,
            tr: ({ children, ...props }) => (
              <tr {...props} className="border-b border-border last:border-b-0">
                {children}
              </tr>
            ),
            th: ({ children, ...props }) => (
              <th
                {...props}
                className="border-r border-border bg-muted/60 px-3 py-2 text-left font-medium last:border-r-0"
              >
                {children}
              </th>
            ),
            td: ({ children, ...props }) => (
              <td {...props} className="border-r border-border px-3 py-2 align-top last:border-r-0">
                {children}
              </td>
            ),
          }}
        >
          {message.content || '...'}
        </ReactMarkdown>
      </div>
    </>
  )
}

export function MessageList({
  scrollContainerRef,
}: {
  scrollContainerRef?: RefObject<HTMLDivElement | null>
}) {
  const messages = useChatStore((state) => state.messages)

  useLayoutEffect(() => {
    const scrollRoot = scrollContainerRef?.current
    if (!scrollRoot) return

    const scrollContainer =
      scrollRoot.querySelector<HTMLDivElement>('[data-slot="scroll-area-viewport"]') ?? scrollRoot

    scrollContainer.scrollTop = scrollContainer.scrollHeight
  }, [messages, scrollContainerRef])

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
        >
          <div
            className={cn(
              'max-w-[76%] rounded-md px-3 py-2 text-sm leading-6',
              message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted/50',
            )}
          >
            <MessageContent message={message} />
            <div
              className={cn(
                'mt-1 text-[11px]',
                message.role === 'user' ? 'text-primary-foreground/70' : 'text-muted-foreground',
              )}
            >
              {message.role} · {formatChatTime(message.createdAt)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
