import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf'
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory'
import { TextLoader } from 'langchain/document_loaders/fs/text'
import { Pinecone } from '@pinecone-database/pinecone'

import { NextApiResponse, NextApiRequest } from 'next'
import { updateVectorDatabase } from '@/lib/utils'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') return

  const { indexname, namespace } = JSON.parse(req.body)

  await handleUpload(indexname, namespace, res)
}

// Use langchain to upload the documents to the database
async function handleUpload(
  indexname: string,
  namespace: string,
  res: NextApiResponse
) {
  // Load the documents from the directory
  const loader = new DirectoryLoader('./documents', {
    '.pdf': (path: string) =>
      new PDFLoader(path, {
        splitPages: false,
      }),
    '.txt': (path: string) => new TextLoader(path),
  })

  // Load the documents into the database
  const docs = await loader.load()

  // console.log(docs)

  const client = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY || '',
  })

  // const listIndexes = await client.listIndexes()

  // console.log('List Indexes', listIndexes)

  const index = client.index(indexname)

  await updateVectorDatabase({
    client,
    indexName: indexname,
    namespace,
    docs,
    processCb: ({
      totalChunks,
      chunksUpserted,
      isCompleted,
      error,
      fileName,
    }) => {
      // console.log(
      //   `Uploading ${fileName} with ${totalChunks} chunks, ${chunksUpserted} chunks upserted, ${isCompleted} completed, ${error}`
      // )

      if (!isCompleted) {
        console.log('Uploading...')
        res.write(
          JSON.stringify({
            fileName,
            totalChunks,
            chunksUpserted,
            isCompleted,
            error,
            progress: (chunksUpserted / totalChunks) * 100,
          })
        )
      } else {
        console.log('Upload completed')
        res.write(
          JSON.stringify({
            fileName,
            totalChunks,
            chunksUpserted,
            isCompleted,
            error,
          })
        )
        res.end()
      }
    },
  })
}
