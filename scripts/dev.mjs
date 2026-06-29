import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const patternDir = resolve(root, 'services/pattern-service')
const patternSrc = resolve(root, 'services/pattern-service/src')
const patternRequirements = resolve(root, 'services/pattern-service/requirements.txt')
const venvDir = resolve(root, 'services/pattern-service/.venv')
const venvPython = resolve(
  venvDir,
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
)

const children = []
let shuttingDown = false

function runSync(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...options.env },
  })
  return new Promise((resolvePromise, reject) => {
    child.on('exit', (code) => {
      if (code === 0) resolvePromise()
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
    })
  })
}

async function ensurePatternVenv() {
  if (!existsSync(venvPython)) {
    await runSync('python3', ['-m', 'venv', venvDir])
  }

  const check = spawn(venvPython, ['-c', 'import grpc, pandas_ta_classic'], {
    cwd: patternDir,
    stdio: 'ignore',
  })
  const ready = await new Promise((resolvePromise) => {
    check.on('exit', (code) => resolvePromise(code === 0))
  })
  if (ready) return

  await runSync(venvPython, ['-m', 'pip', 'install', '-r', patternRequirements])
}

function spawnChild(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      PATTERN_GRPC_HOST: process.env.PATTERN_GRPC_HOST || '127.0.0.1',
      PATTERN_GRPC_PORT: process.env.PATTERN_GRPC_PORT || '50051',
      PATTERN_GRPC_URL: process.env.PATTERN_GRPC_URL || '127.0.0.1:50051',
      PYTHONPATH: process.env.PYTHONPATH ? `${patternSrc}:${process.env.PYTHONPATH}` : patternSrc,
      ...options.env,
    },
  })
  children.push(child)

  child.on('exit', (code, signal) => {
    if (shuttingDown) return
    console.error(`[dev] ${name} exited code=${code ?? 'null'} signal=${signal ?? 'null'}`)
    shutdown(code ?? 1)
  })

  return child
}

function shutdown(code = 0) {
  shuttingDown = true
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
  setTimeout(() => process.exit(code), 300).unref()
}

if (!existsSync(patternRequirements)) {
  console.error('[dev] pattern service requirements.txt is missing')
  process.exit(1)
}

await ensurePatternVenv()

spawnChild('pattern-service', venvPython, ['-m', 'pattern_service.server'])
spawnChild('turbo', 'pnpm', ['dev:node'])

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
