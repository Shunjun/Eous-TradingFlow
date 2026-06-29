import * as workspaceRepo from '../../repositories/workspace.repo.js'

export function listLayouts(userId: string) {
  return workspaceRepo.listLayouts(userId)
}

export function getLayout(userId: string, layoutId: string) {
  return workspaceRepo.getLayout(userId, layoutId)
}

export function createLayout(
  userId: string,
  params: { name: string; schemaJson?: string; setActive?: boolean; copyFromId?: string },
) {
  return workspaceRepo.createLayout(userId, {
    name: params.name,
    schemaJson: params.schemaJson,
    setActive: params.setActive,
  })
}

export function updateLayout(
  userId: string,
  layoutId: string,
  data: { schemaJson?: string; name?: string },
): Promise<void> {
  return workspaceRepo.updateLayout(userId, layoutId, data)
}

export function deleteLayout(userId: string, layoutId: string) {
  return workspaceRepo.deleteLayout(userId, layoutId)
}

export function activateLayout(userId: string, layoutId: string) {
  return workspaceRepo.activateLayout(userId, layoutId)
}
