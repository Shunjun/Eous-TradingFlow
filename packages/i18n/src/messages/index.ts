import type { Locale } from '../locales'
import { en } from './en'
import { zh } from './zh'
import type { MessageCatalog, TextKey } from './types'

export const messages = {
  zh,
  en,
} as const satisfies Record<Locale, MessageCatalog>

export type { TextKey }
