import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../../..')

/** 将 DATABASE_URL 解析为 file: 协议的绝对路径，自动创建目录 */
export function resolveDbUrl(rawUrl: string): string {
  const hasFilePrefix = rawUrl.startsWith('file:')
  const body = hasFilePrefix ? rawUrl.slice(5) : rawUrl
  const clean = body.startsWith('./') ? body.slice(2) : body
  const absolutePath = path.resolve(projectRoot, clean)
  const dir = path.dirname(absolutePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return `file:${absolutePath}`
}
