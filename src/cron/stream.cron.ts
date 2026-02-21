import cron from 'node-cron'
import { StreamQueue } from '@/queue/stream.queue'
import { getPayload } from 'payload'
import payloadConfig from '@/payload.config'

let payloadInstance: any

const getPayloadInstance = async () => {
  if (!payloadInstance) {
    payloadInstance = await getPayload({
      config: payloadConfig,
    })
  }
  return payloadInstance
}

export const startStreamCron = async () => {
  console.log('🕐 Stream cron started (every 1 minute)')
  cron.schedule('* * * * *', async () => {
    console.log('[CRON] Enqueue stream checks')
    try {
      const payload = await getPayloadInstance()
      const creators = await payload.find({
        collection: 'creators1',
        limit: 1000,
      })

      for (const creator of creators.docs as any[]) {
        await StreamQueue.add(
          'check-stream',
          {
            creatorId: creator.id,
            platform: creator.platform,
            channelId: creator.channelId,
            channelName: creator.channelName,
          },
          {
            jobId: `creator-${creator.id}`,// prevents duplicates
            removeOnComplete: true,
            removeOnFail: false,
          },
        )
      }
    }
    catch(err) {
      console.log('[CRON error]', err)
      return err
    }
  })
}
