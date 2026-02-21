import type { PayloadHandler, PayloadRequest } from 'payload'
import { StreamQueue } from '../queue/stream.queue'

export const triggerCheck  = async (req:PayloadRequest) => {
  try {
    const { creatorId } = req.query

    if (!creatorId) {
        return new Response (JSON.stringify({
          status:'400',
        error: 'Missing creatorId parameter. Use: ?creatorId=123',
        })
    )
    }

    // Get the creator
    const creator = await req.payload.findByID({
      collection: 'creators1',
      id: creatorId as string,
    }) as any

    if (!creator) {
        return new Response (JSON.stringify({
          status: '404',
        error: 'Creator not found',
        })
    )
    }

    // Add to queue
    const job = await StreamQueue.add(
      'check-stream',
      {
        creatorId: creator.id,
        platform: creator.platform,
        channelId: creator.channelId,
        channelName: creator.channelName,
      },
      {
        jobId: `manual-${creator.id}-${Date.now()}`,
      }
    )

    return new Request(JSON.stringify({
      success: true,
      message: 'Check queued',
      creator: {
        id: creator.id,
        name: creator.channelName,
        platform: creator.platform,
      },
      jobId: job.id,
    })
)
  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message,
    })
)
  }
}