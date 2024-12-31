'use client'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { Database, MoveUp, RefreshCcw, LucideLoader2 } from 'lucide-react'
import React, { useState } from 'react'

type Props = {}

const VectorDBPage = (props: Props) => {
  const [fileListAsText, setFileListAsText] = useState('')
  const [indexname, setIndexname] = useState('')
  const [namespace, setNamespace] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [filename, setFilename] = useState('')
  const [progress, setProgress] = useState(0)

  const onFileListRefresh = async () => {
    setFileListAsText('')
    const response = await fetch('api/getfilelist', { method: 'GET' })
    const filenames = await response.json()
    console.log(filenames)
    const resultString = (filenames as [])
      .map((filename) => `📄 ${filename}`)
      .join('\n')
    setFileListAsText(resultString)
  }

  console.log(fileListAsText)

  const onStartUpload = async () => {
    setProgress(0)
    setFilename('')
    setIsUploading(true)
    const response = await fetch('api/updatedatabase', {
      method: 'POST',
      body: JSON.stringify({
        indexname,
        namespace,
      }),
    })
    // console.log(response)
    await processStreamedProgress(response)
  }

  // This function is used to process the streamed progress of the upload
  async function processStreamedProgress(response: Response) {
    const reader = response.body?.getReader()
    if (!reader) {
      console.error('Reader was not found')
      return
    }
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log('Done')
          setIsUploading(false)
          break
        }

        const data = new TextDecoder().decode(value)
        console.log(data)

        const { fileName, totalChunks, chunksUpserted, isCompleted, progress } =
          JSON.parse(data)

        if (isCompleted) {
          setIsUploading(false)
          setProgress(100)
          setFilename('')
        }

        setProgress(progress)
        setFilename(`${fileName} [${chunksUpserted}/${totalChunks}]`)
      }
    } catch (error) {
      console.error('Error reading response: ', error)
      setIsUploading(false)
      setProgress(0)
      setFilename('')
    } finally {
      console.log('Releasing lock')
      reader.releaseLock()
    }
  }

  return (
    <main className='flex flex-col items-center p-24'>
      <Card>
        <CardHeader>
          <CardTitle>Update your knowledge base</CardTitle>
          <CardDescription>
            Add new documents to your knowledge base to improve the accuracy of
            your responses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='grid grid-cols-3 gap-4'>
            <div className='col-span-2 grid gap-4 border rounded-lg p-6'>
              <div className='gap-4 relative'>
                <Button
                  onClick={onFileListRefresh}
                  className='absolute -right-4 -top-4'
                  variant={'ghost'}
                  size={'icon'}>
                  <RefreshCcw />
                </Button>
                <Label>Files List:</Label>
                <Textarea
                  readOnly
                  value={fileListAsText}
                  className='min-h-24 resize-none border p-3 shadow-none disabled:cursor-default focus-visible:ring-0 text-sm text-muted-foreground'
                />
              </div>
              <div className='grid grid-cols-2 gap-4'>
                <div className='grid gap-2'>
                  <Label>Index Name</Label>
                  <Textarea
                    value={indexname}
                    onChange={(e) => setIndexname(e.target.value)}
                    placeholder='index name'
                    disabled={isUploading}
                    className='disabled:cursor-default'
                  />
                </div>
                <div className='grid gap-2'>
                  <Label>Namespace</Label>
                  <Textarea
                    value={namespace}
                    onChange={(e) => setNamespace(e.target.value)}
                    placeholder='namespace'
                    disabled={isUploading}
                    className='disabled:cursor-default'
                  />
                </div>
              </div>
            </div>
            <Button
              onClick={onStartUpload}
              variant={'outline'}
              className='w-full h-full'
              disabled={isUploading}>
              <span className='flex flex-row'>
                <Database size={100} className='stroke-[#D90013]' />
                <MoveUp size={100} className='stroke-[#D90013]' />
              </span>
            </Button>
          </div>
          {isUploading && (
            <div className='mt-4'>
              <Label>File Name: {filename}</Label>
              <div className='flex flex-row items-center gap-4'>
                <Progress value={progress} />
                <LucideLoader2 className='stroke-[#D90013] animate-spin' />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

export default VectorDBPage
