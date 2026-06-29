import { promisify } from 'node:util'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'

export interface PatternKline {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface PatternScanSymbol {
  symbol: string
  klines: PatternKline[]
}

export interface PatternSignal {
  pattern: string
  value: number
}

export interface SymbolPatternResult {
  symbol: string
  timeframe: string
  signalTime: number
  signals: PatternSignal[]
}

export interface ScanPatternsRequest {
  timeframe: string
  patterns: string[]
  symbols: PatternScanSymbol[]
}

interface RawPatternClient {
  ScanPatterns(
    request: Record<string, unknown>,
    callback: (error: Error | null, response: unknown) => void,
  ): void
  HealthCheck(
    request: Record<string, never>,
    callback: (error: Error | null, response: unknown) => void,
  ): void
  close(): void
}

let client: RawPatternClient | null = null

function getProtoPath(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url))
  return resolve(currentDir, '../../../../../protos/candlestick_pattern.proto')
}

function getPatternServiceAddress(): string {
  return process.env.PATTERN_GRPC_URL?.trim() || '127.0.0.1:50051'
}

function getClient(): RawPatternClient {
  if (client) return client

  const packageDefinition = protoLoader.loadSync(getProtoPath(), {
    keepCase: false,
    longs: Number,
    enums: String,
    defaults: true,
    oneofs: true,
  })
  const loaded = grpc.loadPackageDefinition(packageDefinition) as unknown as {
    eous: {
      patterns: {
        v1: {
          CandlestickPatternService: new (
            address: string,
            credentials: grpc.ChannelCredentials,
          ) => RawPatternClient
        }
      }
    }
  }
  client = new loaded.eous.patterns.v1.CandlestickPatternService(
    getPatternServiceAddress(),
    grpc.credentials.createInsecure(),
  )
  return client
}

function normalizeScanResponse(response: unknown): SymbolPatternResult[] {
  if (!response || typeof response !== 'object') return []
  const results = (response as { results?: unknown }).results
  if (!Array.isArray(results)) return []

  return results.map((item) => {
    const record = item as Record<string, unknown>
    const signals = Array.isArray(record.signals) ? record.signals : []
    return {
      symbol: String(record.symbol ?? ''),
      timeframe: String(record.timeframe ?? ''),
      signalTime: Number(record.signalTime ?? 0),
      signals: signals.map((signal) => {
        const signalRecord = signal as Record<string, unknown>
        return {
          pattern: String(signalRecord.pattern ?? ''),
          value: Number(signalRecord.value ?? 0),
        }
      }),
    }
  })
}

export async function scanCandlestickPatterns(
  request: ScanPatternsRequest,
): Promise<SymbolPatternResult[]> {
  const rawClient = getClient()
  const scan = promisify(rawClient.ScanPatterns).bind(rawClient) as (
    request: Record<string, unknown>,
  ) => Promise<unknown>

  const response = await scan({
    timeframe: request.timeframe,
    patterns: request.patterns,
    symbols: request.symbols,
  })
  return normalizeScanResponse(response)
}

export async function checkPatternServiceHealth(): Promise<{ ok: boolean; backend: string }> {
  const rawClient = getClient()
  const health = promisify(rawClient.HealthCheck).bind(rawClient) as (
    request: Record<string, never>,
  ) => Promise<unknown>
  const response = (await health({})) as Record<string, unknown>
  return {
    ok: Boolean(response.ok),
    backend: String(response.backend ?? ''),
  }
}
