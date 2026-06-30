export interface ProviderTemplate {
  kind: string
  label: string
  defaultBaseUrl: string
  defaultApiFormat: string
  apiFormats: { value: string; label: string }[]
  hint?: string
}

const OPENAI_COMPATIBLE = { value: 'openai-compatible', label: 'OpenAI Compatible' }
const OPENAI_RESPONSES = { value: 'openai-responses', label: 'OpenAI Responses' }
const ANTHROPIC_MESSAGES = { value: 'anthropic-messages', label: 'Anthropic Messages' }
const GOOGLE_GENERATIVE = { value: 'google-generative', label: 'Google Generative' }

export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    kind: 'openai',
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultApiFormat: 'openai-compatible',
    apiFormats: [OPENAI_COMPATIBLE, OPENAI_RESPONSES],
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
    defaultApiFormat: 'openai-compatible',
    apiFormats: [OPENAI_COMPATIBLE, ANTHROPIC_MESSAGES],
    hint: 'https://platform.deepseek.com/api_keys',
  },
  {
    kind: 'kimi',
    label: 'Kimi / Moonshot',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    defaultApiFormat: 'openai-compatible',
    apiFormats: [OPENAI_COMPATIBLE],
    hint: 'https://platform.moonshot.cn/console/api-keys',
  },
  {
    kind: 'mimo',
    label: 'MiMo',
    defaultBaseUrl: 'https://api.xiaomimimo.com/v1',
    defaultApiFormat: 'openai-compatible',
    apiFormats: [OPENAI_COMPATIBLE],
    hint: 'OpenAI-compatible MiMo endpoint',
  },
  {
    kind: 'glm',
    label: 'GLM / Zhipu',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultApiFormat: 'openai-compatible',
    apiFormats: [OPENAI_COMPATIBLE],
    hint: 'https://open.bigmodel.cn/usercenter/apikeys',
  },
  {
    kind: 'google',
    label: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultApiFormat: 'google-generative',
    apiFormats: [GOOGLE_GENERATIVE, OPENAI_COMPATIBLE],
    hint: 'https://aistudio.google.com/app/apikey',
  },
  {
    kind: 'bailian',
    label: 'Alibaba Bailian',
    defaultBaseUrl: 'https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
    defaultApiFormat: 'openai-compatible',
    apiFormats: [OPENAI_COMPATIBLE],
    hint: 'Use your Bailian workspace endpoint and API key',
  },
  {
    kind: 'volcengine',
    label: 'Volcengine Ark',
    defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    defaultApiFormat: 'openai-compatible',
    apiFormats: [OPENAI_COMPATIBLE],
    hint: 'Volcengine Ark OpenAI-compatible endpoint',
  },
  {
    kind: 'openrouter',
    label: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultApiFormat: 'openai-compatible',
    apiFormats: [OPENAI_COMPATIBLE],
    hint: 'https://openrouter.ai/settings/keys',
  },
  {
    kind: 'ollama',
    label: 'Ollama',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultApiFormat: 'openai-compatible',
    apiFormats: [OPENAI_COMPATIBLE],
    hint: 'Local deployment',
  },
  {
    kind: 'custom',
    label: 'Custom',
    defaultBaseUrl: '',
    defaultApiFormat: 'openai-compatible',
    apiFormats: [OPENAI_COMPATIBLE, OPENAI_RESPONSES, ANTHROPIC_MESSAGES, GOOGLE_GENERATIVE],
    hint: 'Any OpenAI-compatible endpoint',
  },
]
