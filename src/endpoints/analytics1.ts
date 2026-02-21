import type { PayloadHandler, PayloadRequest } from "payload";
import { getViewerSnapshots1, getAggregatedViewerData1 } from '../utils/influxdb.config'

// Get creator performance metrics
export const getCreatorAnalytics1: PayloadHandler = async (req: PayloadRequest) => {
  try {
    const { creatorId, days = 30 } = req.query

    if (!creatorId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'creatorId required'
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - Number(days))

    const analytics = await req.payload.find({
      collection: 'streamanalytics1',
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
        success: true,
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
          streamId: s.stream,
          title: s.title,
          creatorName: s.creatorName,
          platform: s.platform,
          thumbnailURL:s.thumbnailUrl,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          duration: s.duration,
          peakViewers: s.peakViewers,
          averageViewers: s.averageViewers,
          isLive:s.isLive,
        })),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error: any) {
    console.error(' getCreatorAnalytics error:', error.message)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

// Get detailed viewer data for a specific stream (from InfluxDB)
export const getStreamViewerData: PayloadHandler = async (req: PayloadRequest) => {
  try {
    const { streamId, interval = '1m' } = req.query

    if (!streamId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'streamId required'
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    //  Single query - ALL data included!
    const analyticsResult = await req.payload.find({
      collection: 'streamanalytics1',
      where: {
        stream: { equals: streamId }
      },
      limit: 1,
    })

    if (analyticsResult.docs.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Stream analytics not found'
        }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const analytics = analyticsResult.docs[0]
    const startTime = new Date(analytics.startedAt)
    const endTime = analytics.endedAt ? new Date(analytics.endedAt) : new Date()

    // Get detailed viewer snapshots from InfluxDB
    const snapshots = await getViewerSnapshots1(
      analytics.stream as string,
      startTime,
      endTime
    )

    // Get aggregated data for charts
    const aggregatedData = await getAggregatedViewerData1(
      analytics.stream as string,
      interval as string,
      startTime,
      endTime
    )

    return new Response(
      JSON.stringify({
        success: true,
        stream: {
          id: analytics.id,
          streamId: analytics.stream,
          title: analytics.streamTitle,          
          streamUrl: analytics.streamUrl,        
          thumbnailUrl: analytics.thumbnailUrl,  
          creatorName: analytics.creatorName,    
          platform: analytics.platform,
          startedAt: analytics.startedAt,
          endedAt: analytics.endedAt,
          duration: analytics.duration,
          peakViewer: analytics.peakViewer,
          averageViewers: analytics.averageViewers,
          isLive: analytics.isLive,
        },
        viewerData: {
          snapshots: snapshots.slice(-100),
          totalSnapshots: snapshots.length,
          aggregated: aggregatedData,
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error: any) {
    console.error(' getStreamViewerData error:', error.message)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}


// Get platform comparison
export const getPlatformStats: PayloadHandler = async (req: PayloadRequest) => {
  try {
    const { days = 7 } = req.query

    const daysAgo = new Date()
    daysAgo.setDate(daysAgo.getDate() - Number(days))

    // Single query gets everything
    const analytics = await req.payload.find({
      collection: 'streamanalytics1',
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
      const totalDuration = platformStreams.reduce((sum: number, s: any) => sum + (s.duration || 0), 0)

      return {
        platform,
        totalStreams: count,
        averagePeakViewers: count > 0 ? Math.round(totalViewers / count) : 0,
        totalHours: Math.round(totalDuration / 60),
      }
    })

    return new Response(
      JSON.stringify({ 
        success: true,
        period: `${days} days`, 
        platforms: stats 
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error: any) {
    console.error(' getPlatformStats error:', error.message)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

//  Get trending streams - NO EXTRA QUERIES!
export const getTrendingStreams: PayloadHandler = async (req: PayloadRequest) => {
  try {
    const { limit = 10 } = req.query

    // Single query with ALL data already denormalized!
    const analytics = await req.payload.find({
      collection: 'streamanalytics1',
      where: {
        isLive: { equals: true }, // Only live streams
      },
      limit: Number(limit),
      sort: '-peakViewers', // Sort by peak viewers descending
    })

    // Map directly - NO additional queries needed!
    const trending = analytics.docs.map((analytic: any) => ({
      streamId: analytic.stream,
      analyticsId: analytic.id,
      title: analytic.streamTitle,           
      streamUrl: analytic.streamUrl,         
      thumbnailUrl: analytic.thumbnailUrl,   
      creatorName: analytic.creatorName,     
      platform: analytic.platform,
      peakViewers: analytic.peakViewers,
      averageViewers: analytic.averageViewers,
      duration: analytic.duration || 0,
      startedAt: analytic.startedAt,
    }))

    return new Response(
      JSON.stringify({ 
        success: true,
        trending 
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error: any) {
    console.error(' getTrendingStreams error:', error.message)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}