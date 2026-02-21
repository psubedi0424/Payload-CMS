import type { PayloadHandler, PayloadRequest } from 'payload'
import { StreamQueue } from '../queue/stream.queue'

export const systemStatus: PayloadHandler = async (req) => {
  try {
    // Check queue
    const waiting = await StreamQueue.getWaitingCount()
    const active = await StreamQueue.getActiveCount()
    const completed = await StreamQueue.getCompletedCount()
    const failed = await StreamQueue.getFailedCount()

    // Check creators
    const creators = await req.payload.find({
      collection: 'creators1',
      limit: 1000,
    })

    // Check streams
    const streams = await req.payload.find({
      collection: 'streams',
      limit: 1000,
    })

    const liveStreams = streams.docs.filter((s: any) => s.isLive)

    return new Response(JSON.stringify({
      status: 'running',
      timestamp: new Date().toISOString(),
      queue: {
        waiting,
        active,
        completed,
        failed,
        total: waiting + active,
      },
      creators: {
        total: creators.docs.length,
        list: creators.docs.map((c: any) => ({
          id: c.id,
          name: c.channelName,
          platform: c.platform,
        })),
      },
      streams: {
        total: streams.docs.length,
        live: liveStreams.length,
        list: streams.docs.map((s: any) => ({
          id: s.id,
          title: s.title,
          isLive: s.isLive,
          platform: s.platform,
        })),
      },
    })
)
  } catch (error: any) {
    return new  Response(JSON.stringify({
      status: 'error',
      error: error.message,
    })
)
  }
}
