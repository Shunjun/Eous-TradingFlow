import type { AssetRef } from './asset.js'
import type { ExecutionRecord } from './execution.js'
import type { NewsArticle, OHLCVBar, Quote } from './provider.js'
import type { WorkflowDefinition } from './workflow.js'

export interface ApiClient {
  getQuote(symbol: string): Promise<Quote>
  getKlines(params: {
    symbol: string
    interval: string
    from?: number
    to?: number
    limit?: number
  }): Promise<OHLCVBar[]>
  searchNews(params: {
    query: string
    language?: string
    limit?: number
  }): Promise<NewsArticle[]>

  listWorkflows(): Promise<WorkflowDefinition[]>
  getWorkflow(id: string): Promise<WorkflowDefinition>
  saveWorkflow(workflow: WorkflowDefinition): Promise<void>
  deleteWorkflow(id: string): Promise<void>

  executeWorkflow(id: string): Promise<ExecutionRecord>
  cancelExecution(id: string): Promise<void>
  getExecution(id: string): Promise<ExecutionRecord>

  getWatchedAssets(): Promise<AssetRef[]>
  addAsset(asset: AssetRef): Promise<void>
  removeAsset(id: string): Promise<void>
}
