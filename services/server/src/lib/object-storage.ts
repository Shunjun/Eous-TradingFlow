import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { AppError } from './app-error.js'

export interface StoredObject {
  bucket: string
  key: string
  uri: string
  etag: string | null
}

let client: S3Client | null = null
let bucketReady = false

function envValue(...names: string[]): string | null {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return null
}

function getBucket(): string {
  return process.env.KNOWLEDGE_OBJECT_BUCKET?.trim() || 'knowledge'
}

function getClient(): S3Client {
  if (client) return client

  const endpoint = process.env.KNOWLEDGE_OBJECT_ENDPOINT?.trim() || 'http://localhost:9000'
  const region = process.env.KNOWLEDGE_OBJECT_REGION?.trim() || 'us-east-1'
  const forcePathStyle = process.env.KNOWLEDGE_OBJECT_FORCE_PATH_STYLE !== 'false'
  const isLocalEndpoint = /^https?:\/\/(localhost|127\.0\.0\.1|minio)(:\d+)?\/?$/i.test(endpoint)
  const accessKeyId =
    envValue('KNOWLEDGE_OBJECT_ACCESS_KEY', 'MINIO_ROOT_USER') ?? (isLocalEndpoint ? 'eous' : null)
  const secretAccessKey =
    envValue('KNOWLEDGE_OBJECT_SECRET_KEY', 'MINIO_ROOT_PASSWORD') ??
    (isLocalEndpoint ? 'eous_password' : null)

  if (!accessKeyId || !secretAccessKey) {
    throw new AppError(
      'Missing object storage config: KNOWLEDGE_OBJECT_ACCESS_KEY/KNOWLEDGE_OBJECT_SECRET_KEY',
      500,
    )
  }

  client = new S3Client({
    endpoint,
    region,
    forcePathStyle,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })

  return client
}

async function ensureBucket(): Promise<void> {
  if (bucketReady) return

  const s3 = getClient()
  const bucket = getBucket()

  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }))
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }))
  }

  bucketReady = true
}

export async function putKnowledgeObject(params: {
  key: string
  body: Buffer
  contentType?: string | null
  metadata?: Record<string, string>
}): Promise<StoredObject> {
  await ensureBucket()

  const bucket = getBucket()
  const res = await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType ?? undefined,
      Metadata: params.metadata,
    }),
  )

  return {
    bucket,
    key: params.key,
    uri: `s3://${bucket}/${params.key}`,
    etag: res.ETag?.replace(/^"|"$/g, '') ?? null,
  }
}
