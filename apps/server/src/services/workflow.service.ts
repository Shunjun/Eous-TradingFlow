import { AppError } from '../lib/app-error.js'
import * as workflowRepo from '../repositories/workflow.repo.js'

export function listWorkflows(userId: string) {
  return workflowRepo.findByUserId(userId)
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

export async function deleteWorkflow(userId: string, id: string) {
  const workflow = await workflowRepo.findById(id)
  if (!workflow || workflow.userId !== userId) {
    throw new AppError('Workflow not found', 404)
  }
  await workflowRepo.remove(id)
}

export async function publishWorkflow(userId: string, id: string) {
  const workflow = await workflowRepo.findById(id)
  if (!workflow || workflow.userId !== userId) {
    throw new AppError('Workflow not found', 404)
  }

  const nextVersion = await workflowRepo.getNextVersion(id)

  return workflowRepo.createVersion({
    workflowId: id,
    version: nextVersion,
    definition: workflow.definition,
    createdBy: userId,
  })
}

export async function listVersions(userId: string, id: string) {
  const workflow = await workflowRepo.findById(id)
  if (!workflow || workflow.userId !== userId) {
    throw new AppError('Workflow not found', 404)
  }
  return workflowRepo.findVersionsByWorkflowId(id)
}
