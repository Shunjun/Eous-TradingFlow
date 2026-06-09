import { def as klineDef, CanvasNode as KlineCanvas } from '../source.kline/def'
import { def as priceDef, CanvasNode as PriceCanvas } from '../source.price/def'
import { def as branchDef, CanvasNode as BranchCanvas } from '../control.branch/def'

export const sourceKline = { def: klineDef, canvas: KlineCanvas }
export const sourcePrice = { def: priceDef, canvas: PriceCanvas }
export const controlBranch = { def: branchDef, canvas: BranchCanvas }

export type { NodeComponentProps, ParamDef, OutputField, OutputDef, NodeMeta, NodeDef, AcceptableType } from '../types'
