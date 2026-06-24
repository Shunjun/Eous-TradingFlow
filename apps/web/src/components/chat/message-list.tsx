import { cn } from '@eous/ui'
import { formatChatTime } from './format-chat-time'
import { useChatStore } from './store'

export function MessageList() {
  const messages = useChatStore((state) => state.messages)

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
            <div className="whitespace-pre-wrap">{message.content || '...'}</div>
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
