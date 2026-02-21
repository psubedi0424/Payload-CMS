import { Worker } from 'bullmq';
import { connection } from './stream.queue'
import { getPayload } from 'payload';
import payloadConfig from '@/payload.config';

let payloadInstance: any
const getPayloadInstance = async () => {
  if (!payloadInstance) {
    payloadInstance = await getPayload({ config: payloadConfig })
  }
  return payloadInstance
}
export const startStreamCleanupWorker = () => {
  const worker= new Worker(
      'stream-cleanup',

    async (job) => {
    console.log(' Stream cleanup worker started')

      const { streamId } = job.data
      const payload = await getPayloadInstance()

      const stream = await payload.findByID({
        collection: 'streams',
        id: streamId,
      })
    if (!stream) {
        console.log(` Stream already deleted`)
        return
    }

      //  If stream came back live, DO NOT delete
      if (stream?.isLive) {
        console.log(` Stream revived, skipping delete`)
        return
      }

      await payload.delete({
        collection: 'streams',
        id: streamId,
      })

      console.log(`Stream deleted after 5 min`)
    },
    { connection }
  )
    worker.on('ready', () => {
    console.log('🧹 Stream cleanup worker READY')
  })

  worker.on('failed', (job, err) => {
    console.error(' Cleanup job failed:', job?.id, err)
  })

  return worker
}