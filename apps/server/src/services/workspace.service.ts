import * as workspaceRepo from '../repositories/workspace.repo.js'

export function getLayout(userId: string) {
  return workspaceRepo.getLayout(userId)
}

export function saveLayout(userId: string, layout: unknown) {
  return workspaceRepo.saveLayout(userId, layout)
}
