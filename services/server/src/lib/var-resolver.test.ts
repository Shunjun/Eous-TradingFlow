import { describe, it, expect } from 'vitest'
import { resolveValue, resolveString } from './var-resolver'

const nodes = [
  { id: 'n1', type: 'source.kline', data: { label: 'K线' } },
  { id: 'n2', type: 'source.price', data: { label: '报价' } },
  { id: 'n3', type: 'signal', data: { label: 'signal' } },
  { id: 'llm-a', type: 'llm', data: { label: 'LLM' } },
  { id: 'llm-b', type: 'llm', data: { label: 'LLM' } },
  { id: 'source.kline-1', type: 'source.kline', data: { label: 'K线数据' } },
]

const cache: Record<string, Record<string, unknown>> = {
  n1: { symbol: 'BTC/USDT', bars: [{ open: 100 }] },
  n2: { price: 42000, signal: 'long' },
  n3: { signal: 'long', count: 5 },
  'llm-a': { content: 'first' },
  'llm-b': { content: 'second' },
  'source.kline-1': { bars: [{ close: 123 }] },
}

describe('resolveValue', () => {
  it('returns non-string values as-is', () => {
    expect(resolveValue(42, cache, nodes)).toBe(42)
    expect(resolveValue(true, cache, nodes)).toBe(true)
    expect(resolveValue(null, cache, nodes)).toBe(null)
  })

  it('returns static string as-is when no {{}}', () => {
    expect(resolveValue('hello', cache, nodes)).toBe('hello')
  })

  it('resolves whole-value variable to string', () => {
    expect(resolveValue('{{node:n1:symbol}}', cache, nodes)).toBe('BTC/USDT')
  })

  it('resolves whole-value variable to number', () => {
    expect(resolveValue('{{node:n2:price}}', cache, nodes)).toBe(42000)
  })

  it('resolves nested path', () => {
    expect(resolveValue('{{node:n1:bars[0].open}}', cache, nodes)).toBe(100)
  })

  it('resolves explicit node id references without label ambiguity', () => {
    expect(resolveValue('{{node:llm-a:content}}', cache, nodes)).toBe('first')
    expect(resolveValue('{{node:llm-b:content}}', cache, nodes)).toBe('second')
  })

  it('resolves explicit node id references when node id contains dots', () => {
    expect(resolveValue('{{node:source.kline-1:bars[0].close}}', cache, nodes)).toBe(123)
  })

  it('throws on non-existent node', () => {
    expect(() => resolveValue('{{node:missing:field}}', cache, nodes)).toThrow(
      /找不到节点 "missing"/,
    )
  })

  it('throws on non-existent field', () => {
    expect(() => resolveValue('{{node:n1:nonexistent}}', cache, nodes)).toThrow(
      /没有字段 "nonexistent"/,
    )
  })

  it('throws on bad format', () => {
    expect(() => resolveValue('{{badformat}}', cache, nodes)).toThrow(
      /需要 "node:<nodeId>:<field>" 格式/,
    )
  })
})

describe('resolveString', () => {
  it('returns plain string as-is', () => {
    expect(resolveString('no vars here', cache, nodes)).toBe('no vars here')
  })

  it('replaces embedded variable', () => {
    expect(resolveString('买入信号：{{node:n3:signal}}', cache, nodes)).toBe("买入信号：'long'")
  })

  it('auto-quotes string values in embedded mode', () => {
    expect(resolveString('{{node:n3:signal}} === "long"', cache, nodes)).toBe('\'long\' === "long"')
  })

  it('does not quote non-string values in embedded mode', () => {
    expect(resolveString('数量: {{node:n3:count}}', cache, nodes)).toBe('数量: 5')
  })

  it('handles multiple embedded variables', () => {
    const result = resolveString('{{node:n3:signal}} / {{node:n3:count}}', cache, nodes)
    expect(result).toBe("'long' / 5")
  })

  it('returns raw value when entire string is single variable', () => {
    const result = resolveString('{{node:n3:signal}}', cache, nodes)
    expect(result).toBe('long')
  })

  it('stringifies object arrays as JSON for whole-string variables', () => {
    const result = resolveString('{{node:n1:bars}}', cache, nodes)
    expect(result).toBe(JSON.stringify([{ open: 100 }], null, 2))
  })

  it('stringifies object arrays as JSON for embedded variables', () => {
    const result = resolveString('K线数据:\n{{node:n1:bars}}', cache, nodes)
    expect(result).toBe(`K线数据:\n${JSON.stringify([{ open: 100 }], null, 2)}`)
  })
})
