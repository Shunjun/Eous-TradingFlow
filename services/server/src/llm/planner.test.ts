import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchModelsFromProvider, inferDefaultModelCapabilities } from '../lib/model-sync.js'
import { planLlmRequest } from './planner.js'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('planLlmRequest', () => {
  it('disables thinking through the DeepSeek official adapter', () => {
    const plan = planLlmRequest(
      {
        providerKind: 'deepseek',
        apiFormat: 'openai-compatible',
        baseUrl: 'https://api.deepseek.com/v1',
        modelId: 'deepseek-v4-flash',
        capabilities: ['reasoning'],
      },
      { thinkingLevel: 'off' },
    )

    expect(plan).toMatchObject({
      family: 'deepseek',
      apiFormat: 'openai-compatible',
      providerId: 'deepseek',
      adapter: 'deepseek-openai-compatible',
      thinkingLevel: 'off',
      providerOptions: {
        deepseek: {
          thinking: { type: 'disabled' },
        },
      },
    })
  })

  it('keeps OpenRouter DeepSeek models on the OpenAI-compatible dialect', () => {
    const plan = planLlmRequest(
      {
        providerKind: 'openrouter',
        apiFormat: 'openai-compatible',
        baseUrl: 'https://openrouter.ai/api/v1',
        modelId: 'deepseek/deepseek-r1',
        capabilities: ['reasoning'],
      },
      { thinkingLevel: 'off' },
    )

    expect(plan.providerId).toBe('openai-compatible')
    expect(plan.adapter).toBeUndefined()
    expect(plan.providerOptions).toEqual({
      openai: { reasoningEffort: 'none' },
    })
  })

  it('normalizes legacy openai-chat api format to OpenAI-compatible', () => {
    const plan = planLlmRequest(
      {
        providerKind: 'custom',
        apiFormat: 'openai-chat',
        baseUrl: 'https://example.com/v1',
        modelId: 'custom-model',
        capabilities: [],
      },
      { thinkingLevel: 'off' },
    )

    expect(plan.apiFormat).toBe('openai-compatible')
    expect(plan.providerId).toBe('openai-compatible')
  })

  it('does not send reasoning options for non-reasoning OpenAI-compatible models', () => {
    const plan = planLlmRequest(
      {
        providerKind: 'kimi',
        apiFormat: 'openai-compatible',
        baseUrl: 'https://api.moonshot.cn/v1',
        modelId: 'moonshot-v1-8k',
        capabilities: [],
      },
      { thinkingLevel: 'off' },
    )

    expect(plan.providerId).toBe('openai-compatible')
    expect(plan.thinkingLevel).toBe('off')
    expect(plan.providerOptions).toBeUndefined()
  })

  it('normalizes unsupported medium thinking to DeepSeek high support', () => {
    const plan = planLlmRequest(
      {
        providerKind: 'deepseek',
        apiFormat: 'openai-compatible',
        baseUrl: 'https://api.deepseek.com/v1',
        modelId: 'deepseek-v4-pro',
        capabilities: ['reasoning'],
      },
      { thinkingLevel: 'medium' },
    )

    expect(plan.thinkingLevel).toBe('high')
  })

  it('does not enable DeepSeek thinking when reasoning capability is disabled', () => {
    const plan = planLlmRequest(
      {
        providerKind: 'deepseek',
        apiFormat: 'openai-compatible',
        baseUrl: 'https://api.deepseek.com/v1',
        modelId: 'deepseek-v4-pro',
        capabilities: [],
      },
      { thinkingLevel: 'high' },
    )

    expect(plan.thinkingLevel).toBe('off')
    expect(plan.providerOptions).toBeUndefined()
  })

  it('does not enable thinking when an unsupported model has reasoning capability enabled', () => {
    const plan = planLlmRequest(
      {
        providerKind: 'deepseek',
        apiFormat: 'openai-compatible',
        baseUrl: 'https://api.deepseek.com/v1',
        modelId: 'deepseek-chat',
        capabilities: ['reasoning'],
      },
      { thinkingLevel: 'high' },
    )

    expect(plan.thinkingLevel).toBe('off')
    expect(plan.providerOptions).toBeUndefined()
  })

  it('uses Anthropic options for Anthropic Messages', () => {
    const plan = planLlmRequest(
      {
        providerKind: 'anthropic',
        apiFormat: 'anthropic-messages',
        baseUrl: 'https://api.anthropic.com/v1',
        modelId: 'claude-sonnet-4',
        capabilities: ['reasoning'],
      },
      { thinkingLevel: 'off' },
    )

    expect(plan.providerId).toBe('anthropic')
    expect(plan.providerOptions).toEqual({
      anthropic: {
        thinking: { type: 'disabled' },
        sendReasoning: false,
      },
    })
  })

  it('uses Google thinking budgets for Gemini', () => {
    const plan = planLlmRequest(
      {
        providerKind: 'google',
        apiFormat: 'google-generative',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        modelId: 'gemini-2.5-flash-thinking',
        capabilities: ['reasoning', 'vision'],
      },
      { thinkingLevel: 'high' },
    )

    expect(plan.providerId).toBe('google')
    expect(plan.providerOptions).toEqual({
      google: {
        thinkingConfig: { thinkingBudget: 8192 },
      },
    })
  })

  it('does not enable Qwen thinking when reasoning capability is disabled', () => {
    const plan = planLlmRequest(
      {
        providerKind: 'bailian',
        apiFormat: 'openai-compatible',
        baseUrl: 'https://example.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
        modelId: 'qwen3-max',
        capabilities: [],
      },
      { thinkingLevel: 'high' },
    )

    expect(plan.family).toBe('qwen')
    expect(plan.thinkingLevel).toBe('off')
    expect(plan.providerOptions).toBeUndefined()
  })

  it('does not enable Doubao thinking when the model id is not a thinking model', () => {
    const plan = planLlmRequest(
      {
        providerKind: 'volcengine',
        apiFormat: 'openai-compatible',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        modelId: 'doubao-pro-32k',
        capabilities: ['reasoning'],
      },
      { thinkingLevel: 'high' },
    )

    expect(plan.family).toBe('doubao')
    expect(plan.thinkingLevel).toBe('off')
    expect(plan.providerOptions).toBeUndefined()
  })
})

describe('inferDefaultModelCapabilities', () => {
  it('applies default reasoning for DeepSeek v4 models when creating or syncing models', () => {
    expect(
      inferDefaultModelCapabilities({
        kind: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        modelId: 'deepseek-v4-pro',
      }),
    ).toContain('reasoning')
  })

  it('infers OpenRouter DeepSeek reasoning from model id', () => {
    expect(
      inferDefaultModelCapabilities({
        kind: 'openrouter',
        baseUrl: 'https://openrouter.ai/api/v1',
        modelId: 'deepseek/deepseek-r1',
      }),
    ).toContain('reasoning')
  })

  it('infers Bailian Qwen and embedding defaults', () => {
    expect(
      inferDefaultModelCapabilities({
        kind: 'bailian',
        baseUrl: 'https://example.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
        modelId: 'qwen3-max',
      }),
    ).toContain('reasoning')

    expect(
      inferDefaultModelCapabilities({
        kind: 'bailian',
        baseUrl: 'https://example.cn-beijing.maas.aliyuncs.com/compatible-mode/v1',
        modelId: 'text-embedding-v4',
      }),
    ).toContain('embedding')
  })

  it('infers Volcengine Ark defaults', () => {
    expect(
      inferDefaultModelCapabilities({
        kind: 'volcengine',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
        modelId: 'doubao-thinking-pro',
      }),
    ).toContain('reasoning')
  })
})

describe('fetchModelsFromProvider', () => {
  it('parses Volcengine OpenAI-compatible model metadata', async () => {
    globalThis.fetch = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          object: 'list',
          data: [
            {
              id: 'doubao-seed-2-0-pro-260215',
              name: 'doubao-seed-2-0-pro',
              domain: 'VLM',
              features: { tools: { function_calling: true } },
              modalities: { input_modalities: ['text', 'image', 'video'] },
              task_type: ['VisualQuestionAnswering', 'TextGeneration'],
              token_limits: {
                context_window: 262144,
                max_output_token_length: 131072,
                max_reasoning_token_length: 131072,
              },
            },
            {
              id: 'doubao-pro-32k-240828',
              status: 'Shutdown',
            },
            {
              id: 'doubao-embedding-large-text-250515',
              name: 'doubao-embedding-large',
              domain: 'Embedding',
              task_type: ['TextEmbedding'],
              token_limits: { max_input_token_length: 131072 },
            },
          ],
        }),
      } as Response
    }) as unknown as typeof fetch

    const models = await fetchModelsFromProvider(
      'volcengine',
      'https://ark.cn-beijing.volces.com/api/v3',
      'test-key',
      'openai-compatible',
    )

    expect(models).toHaveLength(2)
    expect(models[0]).toMatchObject({
      modelId: 'doubao-seed-2-0-pro-260215',
      displayName: 'doubao-seed-2-0-pro',
      maxTokens: 131072,
      capabilities: expect.arrayContaining(['reasoning', 'vision']),
    })
    expect(models[1]).toMatchObject({
      modelId: 'doubao-embedding-large-text-250515',
      capabilities: expect.arrayContaining(['embedding']),
    })
  })
})
