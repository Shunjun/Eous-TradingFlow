import { AppError } from '../lib/app-error.js'
import * as workflowRepo from '../repositories/workflow.repo.js'
import * as workflowEditService from './workflow-edit.service.js'

export function listWorkflows(userId: string) {
  return workflowRepo.findByUserId(userId)
}

export async function listWorkflowSummaries(userId: string) {
  const workflows = await workflowRepo.findByUserId(userId)
  return workflows
}

export async function getWorkflow(userId: string, id: string) {
  const workflow = await workflowRepo.findById(id)
  if (!workflow || workflow.userId !== userId) {
    throw new AppError('Workflow not found', 404)
  }
  return workflow
}

export function createWorkflow(
  userId: string,
  body: { name: string; description?: string; definition: string },
) {
  return workflowRepo.create({
    userId,
    name: body.name,
    description: body.description ?? '',
    definition: body.definition,
  })
}

export async function updateWorkflow(
  userId: string,
  id: string,
  body: { name?: string; description?: string; definition?: string },
) {
  const workflow = await workflowRepo.findById(id)
  if (!workflow || workflow.userId !== userId) {
    throw new AppError('Workflow not found', 404)
  }
  return workflowRepo.update(id, body)
}

export async function updateWorkflowMeta(
  userId: string,
  id: string,
  body: { name?: string; description?: string },
) {
  const workflow = await workflowRepo.findById(id)
  if (!workflow || workflow.userId !== userId) {
    throw new AppError('Workflow not found', 404)
  }

  const update: { name?: string; description?: string } = {}
  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name) throw new AppError('Workflow name is required', 400)
    update.name = name
  }
  if (body.description !== undefined) update.description = body.description

  return workflowRepo.update(id, update)
}

export async function setWorkflowEnabled(userId: string, id: string, enabled: boolean) {
  const workflow = await workflowRepo.findById(id)
  if (!workflow || workflow.userId !== userId) {
    throw new AppError('Workflow not found', 404)
  }
  if (enabled && !workflow.activeVersionId) {
    throw new AppError('Publish and activate a version before enabling this workflow', 400)
  }
  return workflowRepo.update(id, { enabled })
}

export async function deleteWorkflow(userId: string, id: string) {
  const workflow = await workflowRepo.findById(id)
  if (!workflow || workflow.userId !== userId) {
    throw new AppError('Workflow not found', 404)
  }
  await workflowRepo.remove(id)
}

export async function publishWorkflow(userId: string, id: string, body: { note?: string } = {}) {
  const workflow = await workflowRepo.findById(id)
  if (!workflow || workflow.userId !== userId) {
    throw new AppError('Workflow not found', 404)
  }

  const nextVersion = await workflowRepo.getNextVersion(id)
  const version = await workflowRepo.createVersion({
    workflowId: id,
    version: nextVersion,
    definition: workflow.definition,
    createdBy: userId,
    note: body.note,
  })
  await workflowRepo.update(id, { activeVersionId: version.id })
  return version
}

export async function listVersions(userId: string, id: string) {
  const workflow = await workflowRepo.findById(id)
  if (!workflow || workflow.userId !== userId) {
    throw new AppError('Workflow not found', 404)
  }
  return workflowRepo.findVersionsByWorkflowId(id)
}

export async function setActiveVersion(userId: string, id: string, versionId: string) {
  const workflow = await workflowRepo.findById(id)
  if (!workflow || workflow.userId !== userId) {
    throw new AppError('Workflow not found', 404)
  }
  const version = await workflowRepo.findVersionById(versionId)
  if (!version || version.workflowId !== id) {
    throw new AppError('Workflow version not found', 404)
  }
  return workflowRepo.update(id, { activeVersionId: version.id })
}

export function restoreVersionToDraft(userId: string, id: string, versionId: string) {
  return workflowEditService.restoreWorkflowVersionToDraft(userId, id, versionId)
}
