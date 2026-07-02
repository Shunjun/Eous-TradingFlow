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

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new AppError(`Missing object storage config: ${name}`, 500)
  return value
}

function getBucket(): string {
  return process.env.KNOWLEDGE_OBJECT_BUCKET?.trim() || 'knowledge'
}

function getClient(): S3Client {
  if (client) return client

  const endpoint = process.env.KNOWLEDGE_OBJECT_ENDPOINT?.trim() || 'http://localhost:9000'
  const region = process.env.KNOWLEDGE_OBJECT_REGION?.trim() || 'us-east-1'
  const forcePathStyle = process.env.KNOWLEDGE_OBJECT_FORCE_PATH_STYLE !== 'false'

  client = new S3Client({
    endpoint,
    region,
    forcePathStyle,
    credentials: {
      accessKeyId: requiredEnv('KNOWLEDGE_OBJECT_ACCESS_KEY'),
      secretAccessKey: requiredEnv('KNOWLEDGE_OBJECT_SECRET_KEY'),
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
