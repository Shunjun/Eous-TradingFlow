import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCheck, Circle, Info, X } from 'lucide-react'
import { Button, Popover, PopoverContent, PopoverTrigger, ScrollArea, cn } from '@eous/ui'
import type { NotificationDTO } from '@eous/api-client'
import { useNotificationsStore } from '../../stores/notifications'

function formatRelativeTime(value: string): string {
  const diffMs = Date.now() - Date.parse(value)
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60_000))
  if (diffMinutes < 1) return '刚刚'
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} 小时前`
  return `${Math.floor(diffHours / 24)} 天前`
}

function severityClass(severity: NotificationDTO['severity']) {
  if (severity === 'success') return 'text-emerald-500'
  if (severity === 'warning') return 'text-amber-500'
  if (severity === 'error') return 'text-destructive'
  return 'text-primary'
}

function NotificationItem({ notification }: { notification: NotificationDTO }) {
  const markRead = useNotificationsStore((state) => state.markRead)
  const archive = useNotificationsStore((state) => state.archive)
  const unread = !notification.readAt
  const content = (
    <div
      className={cn(
        'group flex min-w-0 gap-3 px-3 py-3 transition hover:bg-muted/50',
        unread && 'bg-primary/5',
      )}
    >
      <Info size={15} className={cn('mt-0.5 shrink-0', severityClass(notification.severity))} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          {unread && <Circle size={7} className="shrink-0 fill-primary text-primary" />}
          <div className="truncate text-sm font-medium">{notification.title}</div>
        </div>
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
          {notification.message}
        </p>
        <div className="mt-2 text-[11px] text-muted-foreground">
          {formatRelativeTime(notification.createdAt)}
        </div>
      </div>
      <div className="flex shrink-0 opacity-0 transition group-hover:opacity-100">
        {unread && (
          <Button
            variant="ghost-icon"
            size="xs"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              void markRead(notification.id)
            }}
          >
            <CheckCheck size={12} />
          </Button>
        )}
        <Button
          variant="ghost-icon"
          size="xs"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void archive(notification.id)
          }}
        >
          <X size={12} />
        </Button>
      </div>
    </div>
  )

  return notification.actionUrl ? (
    <Link to={notification.actionUrl} onClick={() => unread && void markRead(notification.id)}>
      {content}
    </Link>
  ) : (
    content
  )
}

export function NotificationBell() {
  const notifications = useNotificationsStore((state) => state.notifications)
  const unreadCount = useNotificationsStore((state) => state.unreadCount)
  const connectionState = useNotificationsStore((state) => state.connectionState)
  const loading = useNotificationsStore((state) => state.loading)
  const loadInitial = useNotificationsStore((state) => state.loadInitial)
  const refreshOnOpen = useNotificationsStore((state) => state.refreshOnOpen)
  const connect = useNotificationsStore((state) => state.connect)
  const markAllRead = useNotificationsStore((state) => state.markAllRead)

  useEffect(() => {
    void loadInitial()
    return connect()
  }, [connect, loadInitial])

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) void refreshOnOpen()
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost-icon"
          size="sm"
          aria-label="通知中心"
          className="relative size-8 p-0"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute right-0 top-0 min-w-4 rounded-full bg-destructive px-1 text-[10px] leading-4 text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          <span
            className={cn(
              'absolute bottom-1 right-1 h-2 w-2 rounded-full border border-sidebar',
              connectionState === 'connected' ? 'bg-emerald-500' : 'bg-muted-foreground',
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <div>
            <div className="text-sm font-semibold">通知中心</div>
            <div className="text-xs text-muted-foreground">{unreadCount} 条未读通知</div>
          </div>
          <Button
            variant="ghost"
            size="xs"
            disabled={unreadCount === 0}
            onClick={() => void markAllRead()}
          >
            全部已读
          </Button>
        </div>
        <ScrollArea className="h-[420px]">
          {notifications.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              {loading ? '正在加载通知...' : '暂无通知'}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
