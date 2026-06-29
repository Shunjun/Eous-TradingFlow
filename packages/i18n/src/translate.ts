import { defaultLocale, type Locale } from './locales'
import { messages, type TextKey } from './messages'

export function getText(locale: Locale, key: TextKey): string {
  return messages[locale][key] ?? messages[defaultLocale][key]
}
