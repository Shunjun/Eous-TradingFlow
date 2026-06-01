export interface ProviderTemplate {
  kind: string
  label: string
  defaultBaseUrl: string
  hint?: string
}

export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    kind: 'openai',
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    hint: 'https://platform.openai.com/api-keys',
  },
  {
    kind: 'anthropic',
    label: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    hint: 'https://console.anthropic.com/keys',
  },
  {
    kind: 'deepseek',
    label: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    hint: 'https://platform.deepseek.com/api_keys',
  },
  {
    kind: 'ollama',
    label: 'Ollama',
    defaultBaseUrl: 'http://localhost:11434/v1',
    hint: 'Local deployment',
  },
  {
    kind: 'custom',
    label: 'Custom',
    defaultBaseUrl: '',
    hint: 'Any OpenAI-compatible endpoint',
  },
]