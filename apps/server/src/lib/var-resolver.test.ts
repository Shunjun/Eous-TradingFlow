import { describe, it, expect } from 'vitest'
import { resolveValue, resolveString } from './var-resolver'

const nodes = [
  { id: 'n1', type: 'source.kline', data: { label: 'K线' } },
  { id: 'n2', type: 'source.price', data: { label: '报价' } },
  { id: 'n3', type: 'signal', data: { label: 'signal' } },
]

const cache: Record<string, Record<string, unknown>> = {
  n1: { symbol: 'BTC/USDT', bars: [{ open: 100 }] },
  n2: { price: 42000, signal: 'long' },
  n3: { signal: 'long', count: 5 },
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
    expect(resolveValue('{{K线.symbol}}', cache, nodes)).toBe('BTC/USDT')
  })

  it('resolves whole-value variable to number', () => {
    expect(resolveValue('{{报价.price}}', cache, nodes)).toBe(42000)
  })

  it('resolves nested path', () => {
    expect(resolveValue('{{K线.bars[0].open}}', cache, nodes)).toBe(100)
  })

  it('resolves via type fallback when label not found', () => {
    expect(resolveValue('{{source.kline.symbol}}', cache, nodes)).toBe('BTC/USDT')
  })

  it('throws on non-existent node', () => {
    expect(() => resolveValue('{{不存在.field}}', cache, nodes)).toThrow(
      /找不到标签或类型为 "不存在" 的节点/,
    )
  })

  it('throws on non-existent field', () => {
    expect(() => resolveValue('{{K线.nonexistent}}', cache, nodes)).toThrow(
      /没有字段 "nonexistent"/,
    )
  })

  it('throws on bad format', () => {
    expect(() => resolveValue('{{badformat}}', cache, nodes)).toThrow(
      /需要 "label\.field" 格式/,
    )
  })
})

describe('resolveString', () => {
  it('returns plain string as-is', () => {
    expect(resolveString('no vars here', cache, nodes)).toBe('no vars here')
  })

  it('replaces embedded variable', () => {
    expect(resolveString('买入信号：{{signal.signal}}', cache, nodes)).toBe(
      "买入信号：'long'",
    )
  })

  it('auto-quotes string values in embedded mode', () => {
    expect(resolveString('{{signal.signal}} === "long"', cache, nodes)).toBe(
      "'long' === \"long\"",
    )
  })

  it('does not quote non-string values in embedded mode', () => {
    expect(resolveString('数量: {{signal.count}}', cache, nodes)).toBe('数量: 5')
  })

  it('handles multiple embedded variables', () => {
    const result = resolveString('{{signal.signal}} / {{signal.count}}', cache, nodes)
    expect(result).toBe("'long' / 5")
  })

  it('returns raw value when entire string is single variable', () => {
    const result = resolveString('{{signal.signal}}', cache, nodes)
    expect(result).toBe('long')
  })
})
