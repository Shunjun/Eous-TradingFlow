import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

export function formatChatTime(value: string): string {
  const date = dayjs(value)
  if (!date.isValid()) return ''

  if (dayjs().diff(date, 'hour') < 24) {
    return date.fromNow()
  }

  return date.isSame(dayjs(), 'year') ? date.format('M月D日') : date.format('YYYY年M月D日')
}
