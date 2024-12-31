import {
  Pinecone,
  PineconeRecord,
  RecordMetadata,
} from '@pinecone-database/pinecone'
import { Document } from '@langchain/core/documents'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { FeatureExtractionPipeline, pipeline } from '@huggingface/transformers'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

let callBack: ({
  fileName,
  totalChunks,
  chunksUpserted,
  isCompleted,
  error,
}: {
  fileName: string
  totalChunks: number
  chunksUpserted: number
  isCompleted: boolean
  error?: string
}) => void

let totalChunks = 0
let chunksUpserted = 0

type UpdateVectorDatabaseProps = {
  indexName: string
  namespace: string
  client: Pinecone
  docs: Document[]
  processCb: ({
    fileName,
    totalChunks,
    chunksUpserted,
    isCompleted,
    error,
  }: {
    fileName: string
    totalChunks: number
    chunksUpserted: number
    isCompleted: boolean
    error?: string
  }) => void
}

// This function is used to update the vector database with the documents
export async function updateVectorDatabase({
  indexName,
  namespace,
  docs,
  processCb,
  client,
}: UpdateVectorDatabaseProps) {
  const modelName = 'mixedbread-ai/mxbai-embed-large-v1'
  const extractor = await pipeline('feature-extraction', modelName, {
    dtype: 'fp32',
  })

  callBack = processCb
  // console.log(extractor)

  for (const doc of docs) {
    await processDocument(client, indexName, namespace, doc, extractor)
  }

  if (callBack !== undefined) {
    callBack({
      fileName: 'filename',
      totalChunks,
      chunksUpserted,
      isCompleted: true,
    })
  }
}

// This function is used to process a single document and split it into chunks and then upsert the chunks into the vector database
async function processDocument(
  client: Pinecone,
  indexName: string,
  namespace: string,
  doc: Document<Record<string, any>>,
  extractor: FeatureExtractionPipeline
) {
  // console.log(`Processing document`, JSON.stringify(doc, null, 2))

  const splitter = new RecursiveCharacterTextSplitter()
  const documentChunks = await splitter.splitText(doc.pageContent)
  totalChunks += documentChunks.length

  // console.log(documentChunks)

  const fileName = getFileName(doc.metadata.source)

  let currentBatchIndex = 0
  const batchSize = 10

  while (documentChunks?.length > 0) {
    currentBatchIndex++
    const batch = documentChunks.splice(0, batchSize)
    await processChunkInBatch(
      client,
      indexName,
      namespace,
      batch,
      fileName,
      currentBatchIndex,
      extractor
    )
  }
}

// This function is used to process a single batch of chunks and upsert the chunks into the vector database
async function processChunkInBatch(
  client: Pinecone,
  indexName: string,
  namespace: string,
  chunks: string[],
  fileName: string,
  currentBatchIndex: number,
  extractor: FeatureExtractionPipeline
) {
  const output = await extractor(
    chunks.map((chunk) => chunk.replace(/\n/g, ' ')),
    {
      pooling: 'cls',
    }
  ) // Remove newlines

  // console.log(output)

  const embeddingBatch = output.tolist()

  // console.log(embeddingBatch)

  let vectorBatch: PineconeRecord<RecordMetadata>[] = []

  for (let i = 0; i < chunks.length; i++) {
    vectorBatch.push({
      id: `${fileName}-${currentBatchIndex}-${i}`,
      values: embeddingBatch[i],
      metadata: {
        chunk: chunks[i],
        fileName,
        batchIndex: currentBatchIndex,
        index: i,
      },
    })
  }

  const index = client.Index(indexName).namespace(namespace)
  const upsertResponse = await index.upsert(vectorBatch)

  chunksUpserted += vectorBatch.length

  if (callBack !== undefined) {
    callBack({
      fileName,
      totalChunks,
      chunksUpserted,
      isCompleted: false,
    })
  }
  // console.log(upsertResponse)
  vectorBatch = []
  return upsertResponse
}

// This function is used to get the file name from the document metadata
function getFileName(fileName: string) {
  const docName = fileName.substring(fileName.lastIndexOf('/') + 1)
  return docName.substring(0, docName.lastIndexOf('.')) || docName
}
