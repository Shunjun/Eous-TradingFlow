export type ApiFormat =
  | 'openai-chat'
  | 'openai-responses'
  | 'anthropic-messages'
  | 'google-generative'

export type ThinkingLevel = 'off' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export type JsonValue =
  | null
  | string
  | number
  | boolean
  | JsonValue[]
  | { [key: string]: JsonValue }

export type ProviderOptions = Record<string, Record<string, JsonValue>>

export interface ResolvedModel {
  providerKind: string
  apiFormat: string
  baseUrl: string
  modelId: string
  capabilities?: string[]
}

export interface ModelFamilyCapabilities {
  family: string
  reasoning: boolean
  multimodal: boolean
  supportedThinkingLevels: ThinkingLevel[]
  defaultThinkingLevel: ThinkingLevel
  allowedApiFormats: ApiFormat[]
}

export interface LlmPlan {
  family: string
  apiFormat: ApiFormat
  providerId: string
  adapter?: string
  thinkingLevel: ThinkingLevel
  providerOptions?: ProviderOptions
}

export interface LlmPlanInput {
  model: ResolvedModel
  family: ModelFamilyCapabilities
  apiFormat: ApiFormat
  thinkingLevel: ThinkingLevel
}

export interface DialectPlan {
  providerId: string
  providerOptions?: ProviderOptions
}

export interface Dialect {
  apiFormat: ApiFormat
  plan(input: LlmPlanInput): DialectPlan
}

export interface ProviderAdapter {
  id: string
  matches(input: LlmPlanInput): boolean
  patch(plan: DialectPlan, input: LlmPlanInput): DialectPlan
}
