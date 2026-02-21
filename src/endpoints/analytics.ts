import { Success } from "node_modules/@payloadcms/ui/dist/providers/ToastContainer/icons/Success";
import type { PayloadHandler, PayloadRequest, CollectionSlug} from "payload";
// Get creator performance metrics
export const getCreatorAnalytics: PayloadHandler = async (req:PayloadRequest) => {
  try {
    const { creatorId, days = 30 } = req.query

    if (!creatorId) {
        return new Response(
            JSON.stringify({
                success:false,
                error: 'creatorId required'
            }),)
    }

    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - Number(days))

    const analytics = await req.payload.find({
      collection :'Stream-Analytics',
      where: {
        and: [
          { creator: { equals: creatorId } },
          { startedAt: { greater_than_equal: daysAgo.toISOString() } },
        ],
      },
      limit: 1000,
    })

    const streams = analytics.docs

    // Calculate metrics
    const totalStreams = streams.length
    const totalMinutes = streams.reduce((sum: number, s: any) => sum + (s.duration || 0), 0)
    const avgDuration = totalStreams > 0 ? Math.round(totalMinutes / totalStreams) : 0
    const avgPeakViewers = totalStreams > 0
      ? Math.round(streams.reduce((sum: number, s: any) => sum + (s.peakViewers || 0), 0) / totalStreams)
      : 0
    const avgViewers = totalStreams > 0
      ? Math.round(streams.reduce((sum: number, s: any) => sum + (s.averageViewers || 0), 0) / totalStreams)
      : 0

      return new Response(
        JSON.stringify({
        success:true,
        creatorId,
        period: `${days} days`,
        metrics: {
            totalStreams,
            totalHours: Math.round(totalMinutes / 60),
            averageDuration: avgDuration,
            averagePeakViewers: avgPeakViewers,
            averageViewers: avgViewers,
      },
      streams: streams.map((s: any) => ({
        id: s.id,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        duration: s.duration,
        peakViewers: s.peakViewers,
        averageViewers: s.averageViewers,
      })),
    }))
  } catch (error: any) {
      return new Response(
          JSON.stringify({
            success:false,
            error: error.message
          }),)
    }
}

// Get platform comparison
export const getPlatformStats: PayloadHandler = async (req:any) => {
  try {
    const { days = 7 } = req.query

    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - Number(days))

    const analytics = await req.payload.find({
      collection: 'Stream-Analytics',
      where: {
        startedAt: { greater_than_equal: daysAgo.toISOString() },
      },
      limit: 10000,
    })

    // Group by platform
    const platforms = ['youtube', 'twitch', 'kick', 'rumble']
    const stats = platforms.map(platform => {
      const platformStreams = analytics.docs.filter((s: any) => s.platform === platform)
      const count = platformStreams.length
      const totalViewers = platformStreams.reduce((sum: number, s: any) => sum + (s.peakViewers || 0), 0)

      return {
        platform,
        totalStreams: count,
        averagePeakViewers: count > 0 ? Math.round(totalViewers / count) : 0,
      }
    })

    return new Response(JSON.stringify({ period: `${days} days`, platforms: stats }))
  } catch (error: any) {
      return new Response(JSON.stringify({ error: error.message }),
      {status:500})
  }
}

// Get trending streams
export const getTrendingStreams: PayloadHandler = async (req:any) => {
  try {
    const { limit = 10 } = req.query

    const analytics = await req.payload.find({
      collection: 'Stream-Analytics',
      where: {
        endedAt: { equals: null }, // Only live streams
      },
      limit: Number(limit),
      sort: '-peakViewers', // Sort by peak viewers
    })

    const trending = await Promise.all(
      analytics.docs.map(async (analytics: any) => {
        const stream = await req.payload.findByID({
          collection: 'streams',
          id: analytics.stream,
        })
        
        const creator = await req.payload.findByID({
          collection: 'creators1',
          id: analytics.creator,
        })

        return {
          streamId: stream.id,
          title: stream.title,
          creatorName: creator.channelName,
          platform: analytics.platform,
          currentViewers: stream.viewerCount,
          peakViewers: analytics.peakViewers,
          duration: analytics.duration || 0,
        }
      })
    )

    return new Response (JSON.stringify({ trending }),)
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }),{status:500})
  }
}
