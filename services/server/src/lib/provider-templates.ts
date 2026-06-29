export interface ProviderTemplate {
  kind: string
  label: string
  defaultBaseUrl: string
  defaultApiFormat: string
  apiFormats: { value: string; label: string }[]
  hint?: string
}

const OPENAI_CHAT = { value: 'openai-chat', label: 'OpenAI Chat' }
const OPENAI_RESPONSES = { value: 'openai-responses', label: 'OpenAI Responses' }
const ANTHROPIC_MESSAGES = { value: 'anthropic-messages', label: 'Anthropic Messages' }
const GOOGLE_GENERATIVE = { value: 'google-generative', label: 'Google Generative' }

export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    kind: 'openai',
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultApiFormat: 'openai-chat',
    apiFormats: [OPENAI_CHAT, OPENAI_RESPONSES],
    hint: 'https://platform.openai.com/api-keys',
  },
  {
    kind: 'anthropic',
    label: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultApiFormat: 'anthropic-messages',
    apiFormats: [ANTHROPIC_MESSAGES],
    hint: 'https://console.anthropic.com/keys',
  },
  {
    kind: 'deepseek',
    label: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultApiFormat: 'openai-chat',
    apiFormats: [OPENAI_CHAT, ANTHROPIC_MESSAGES],
    hint: 'https://platform.deepseek.com/api_keys',
  },
  {
    kind: 'kimi',
    label: 'Kimi / Moonshot',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    defaultApiFormat: 'openai-chat',
    apiFormats: [OPENAI_CHAT],
    hint: 'https://platform.moonshot.cn/console/api-keys',
  },
  {
    kind: 'mimo',
    label: 'MiMo',
    defaultBaseUrl: 'https://api.xiaomimimo.com/v1',
    defaultApiFormat: 'openai-chat',
    apiFormats: [OPENAI_CHAT],
    hint: 'OpenAI-compatible MiMo endpoint',
  },
  {
    kind: 'glm',
    label: 'GLM / Zhipu',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultApiFormat: 'openai-chat',
    apiFormats: [OPENAI_CHAT],
    hint: 'https://open.bigmodel.cn/usercenter/apikeys',
  },
  {
    kind: 'google',
    label: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultApiFormat: 'google-generative',
    apiFormats: [GOOGLE_GENERATIVE, OPENAI_CHAT],
    hint: 'https://aistudio.google.com/app/apikey',
  },
  {
    kind: 'openrouter',
    label: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultApiFormat: 'openai-chat',
    apiFormats: [OPENAI_CHAT],
    hint: 'https://openrouter.ai/settings/keys',
  },
  {
    kind: 'ollama',
    label: 'Ollama',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultApiFormat: 'openai-chat',
    apiFormats: [OPENAI_CHAT],
    hint: 'Local deployment',
  },
  {
    kind: 'custom',
    label: 'Custom',
    defaultBaseUrl: '',
    defaultApiFormat: 'openai-chat',
    apiFormats: [OPENAI_CHAT, OPENAI_RESPONSES, ANTHROPIC_MESSAGES, GOOGLE_GENERATIVE],
    hint: 'Any OpenAI-compatible endpoint',
  },
]
