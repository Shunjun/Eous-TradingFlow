import { describe, expect, it } from 'vitest'
import { planLlmRequest } from './planner.js'

describe('planLlmRequest', () => {
  it('disables thinking through the DeepSeek official adapter', () => {
    const plan = planLlmRequest(
      {
        providerKind: 'deepseek',
        apiFormat: 'openai-chat',
        baseUrl: 'https://api.deepseek.com/v1',
        modelId: 'deepseek-v4-flash',
        capabilities: ['reasoning'],
      },
      { thinkingLevel: 'off' },
    )

    expect(plan).toMatchObject({
      family: 'deepseek',
      apiFormat: 'openai-chat',
      providerId: 'deepseek',
      adapter: 'deepseek-official',
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
        apiFormat: 'openai-chat',
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

  it('does not send reasoning options for non-reasoning OpenAI-compatible models', () => {
    const plan = planLlmRequest(
      {
        providerKind: 'kimi',
        apiFormat: 'openai-chat',
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
        apiFormat: 'openai-chat',
        baseUrl: 'https://api.deepseek.com/v1',
        modelId: 'deepseek-v4-pro',
        capabilities: ['reasoning'],
      },
      { thinkingLevel: 'medium' },
    )

    expect(plan.thinkingLevel).toBe('high')
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
})
