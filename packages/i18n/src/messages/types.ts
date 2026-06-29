import type { zh } from './zh'

export type TextKey = keyof typeof zh

export type MessageCatalog = Record<TextKey, string>
