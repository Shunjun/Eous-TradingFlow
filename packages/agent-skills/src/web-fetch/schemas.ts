import { z } from 'zod'

export const webFetchUrlInputSchema = z.object({
  url: z.string().url(),
  format: z.enum(['text', 'html']).default('text'),
  maxChars: z.number().int().min(500).max(30000).default(12000),
})

export type WebFetchUrlInput = z.infer<typeof webFetchUrlInputSchema>
