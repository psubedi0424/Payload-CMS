// import { writeViewerMetric, getPeakViewers1, getAverageViewers1, getSnapshotCount1 } from '../utils/influxdb.config'
// import { getCache, setCache, deleteCache, CacheKeys, CACHE_TTL, invalidateStreamCaches } from '../db/redis.config'

// export async function trackstreamanalytics(
//     payload: any,
//     streamId: string, 
//     stream: any,
//     liveInfo: any
// ) {
//     try {
//         const now = new Date()
//         const viewerCount= liveInfo.viewerCount || 0
        
//         // Write viewer count to InfluxDB (time-series database)
//         const writeSucess=await writeViewerMetric(
//             streamId,
//             stream.creator.toString(),
//             stream.platform,
//             liveInfo.viewerCount || 0,
//             now
//         )
//         if (!writeSucess) {
//             console.log('Failed to write in influxdb.')
//         }
        
//         console.log(`📊 Viewer metric written to InfluxDB: ${liveInfo.viewerCount} viewers`)

//         let creatorData = null

//         // Find or create Stream-Analytics record (metadata only, no snapshots)
//         const existing = await payload.find({
//             collection: 'streamanalytics1',
//             where: {
//                 stream: { equals: streamId }
//             },
//             limit: 1
//         })

//         if (existing.docs.length === 0) {

//             try {
//                 const creator = await payload.findByID({
//                     collection: 'creators1',
//                     id: stream.creator,
//                 })
//                 creatorData = {
//                     creatorName: creator.channelName || 'Unknown',
//                     creatorAvatar: creator.avatar?.url || creator.avatarUrl || null,
//                 }
//                 console.log(`👤 Fetched creator data: ${creatorData.creatorName}`)
//             } catch (err: any) {
//                 console.error(` Failed to fetch creator:`, err.message)
//                 creatorData = {
//                     creatorName: 'Unknown',
//                     creatorAvatar: null,
//                 }
//             }
//             const thumbnailUrl = stream.thumbnail?.url || stream.thumbnailUrl || null
//             // Create analytics record (without viewer snapshots array)
//             const newanalytics = await payload.create({
//                 collection: 'streamanalytics1',
//                 data: {
//                     stream: streamId,
//                     creator: stream.creator,

//                     // Denormalized stream data (NO QUERIES NEEDED LATER!)
//                     streamTitle: liveInfo.title || stream.title || 'Untitled Stream',
//                     streamUrl: liveInfo.streamUrl || stream.streamUrl,
//                     thumbnailUrl: thumbnailUrl,

//                     //Denormalized creator data (NO QUERIES NEEDED LATER!)
//                     creatorName: creatorData.creatorName,

//                     platform: stream.platform,
//                     startedAt: stream.startedAt || now,
//                     isLive: true,

//                     peakViewer: viewerCount,
//                     averageViewers: viewerCount,
//                     totalSnapshots:1,
//                     lastupdated: now,
//                     // No viewerSnapshots array - stored in InfluxDB
//                 },
//             })
//             console.log(`✨ Stream Analytics record created for stream ${streamId}`)
//         } else {
//             // Calculate real-time metrics from InfluxDB
//             const analytics = existing.docs[0]
//             const startTime = analytics.startedAt ? new Date(analytics.startedAt) : undefined
            
//             // Get peak and average from InfluxDB
//             const [peakViewers, averageViewers,snapshotCount] = await Promise.all([
//                 getPeakViewers1(streamId, startTime, now),
//                 getAverageViewers1(streamId, startTime, now),
//                 getSnapshotCount1(streamId,startTime,now),
//             ])

//             const updateData: any = {
//                 peakViewers: peakViewers || viewerCount,
//                 averageViewers: averageViewers || viewerCount,
//                 totalSnapshots: snapshotCount,
//                 lastUpdated: now,
//                 isLive: true,
//             }

//             // Update stream title if it changed (rare, but possible)
//             if (liveInfo.title && liveInfo.title !== analytics.streamTitle) {
//                 updateData.streamTitle = liveInfo.title
//                 console.log(`📝 Stream title updated: "${liveInfo.title}"`)
//             }

//             await payload.update({
//                 collection: 'streamanalytics1',
//                 id: analytics.id,
//                 data: updateData,
//             })
            
//             console.log(` Analytics updated - Peak: ${peakViewers}, Avg: ${averageViewers}`)
//         }
//     } catch (error: any) {
//         console.error(` Analytics Error for stream ${streamId}:`, error.message)
//         // Don't throw - let the main worker continue even if analytics fail
//     }
// }

// // Function to finalize analytics when stream ends
// export async function finalizeStreamAnalytics(
//     payload: any,
//     streamId: string,
//     endedAt: Date
// ) {
//     try {
//         const analytics = await payload.find({
//             collection: 'streamanalytics1',
//             where: { stream: { equals: streamId } },
//             limit: 1
//         })

//         if (analytics.docs.length === 0) {
//             console.log(` No analytics found for stream ${streamId}`)
//             return
//         }

//         const analyticsDoc = analytics.docs[0]
//         if (analyticsDoc.endedAt) {
//             console.log('Analytics Finalized to avoidre processing')
//             return
//         }
//         const startedAt = new Date(analyticsDoc.startedAt)
        

//         // Calculate final metrics from InfluxDB
//         const [peakViewers, averageViewers,totalSnapshots] = await Promise.all([
//             getPeakViewers1(streamId, startedAt, endedAt),
//             getAverageViewers1(streamId, startedAt, endedAt),
//             getSnapshotCount1(streamId,startedAt,endedAt)
//         ])

//         // Calculate duration
//         const durationMs = endedAt.getTime() - startedAt.getTime()
//         const durationMinutes = Math.round(durationMs / 1000 / 60)

//         // Update final analytics
//         await payload.update({
//             collection: 'streamanalytics1',
//             id: analyticsDoc.id,
//             data: {
//                 endedAt:endedAt,
//                 peakViewers:peakViewers,
//                 averageViewers:averageViewers,
//                 duration: durationMinutes,
//                 totalSnapshots: totalSnapshots,
//                 isLive: false,
//             }
//         })

//         console.log(` Stream analytics finalized - Duration: ${durationMinutes}m, Peak: ${peakViewers}, Avg: ${averageViewers}`)
//     } catch (error: any) {
//         console.error(` Error finalizing analytics for stream ${streamId}:`, error.message)
//     }
// }
import { writeViewerMetric, getPeakViewers1, getAverageViewers1, getSnapshotCount1 } from '../utils/influxdb.config'
import { getCache, setCache, deleteCache, CacheKeys, CACHE_TTL, invalidateStreamCaches } from '../db/redis.config'
import { getCreatorCached } from '../db/mongodb.helper'

interface StreamAnalytics {
  id: string
  stream: string
  creator: string | { id: string }
  streamTitle: string
  creatorName: string
  creatorAvatar?: string | null
  platform: string
  startedAt: string | Date
  endedAt?: string | Date
  peakViewers: number
  averageViewers: number
  totalSnapshots: number
  duration?: number
  isLive: boolean
  lastUpdated?: Date
}

export async function trackstreamanalytics(
    payload: any,
    streamId: string, 
    stream: any,
    liveInfo: any
) {
    try {
        const now = new Date()
        const viewerCount = liveInfo.viewerCount || 0
        
        console.log(`Tracking analytics for stream ${streamId} - Viewers: ${viewerCount}`)
        
        // Write viewer count to InfluxDB (time-series database)
        const writeSuccess = await writeViewerMetric(
            streamId,
            stream.creator.toString(),
            stream.platform,
            viewerCount,
            now
        )
        
        if (!writeSuccess) {
            console.error('Failed to write to InfluxDB, but continuing...')
        } else {
            console.log(`Viewer metric written to InfluxDB: ${viewerCount} viewers`)
        }

        //Check if analytics exists in cache
        const cacheKey = CacheKeys.analytics(streamId)
        let existingAnalytics = await getCache<StreamAnalytics>(cacheKey)
        
        // If not in cache, query MongoDB
        if (!existingAnalytics) {
            console.log(`Analytics not in cache, querying MongoDB...`)
            const existing = await payload.find({
                collection: 'streamanalytics1',
                where: {
                    stream: { equals: streamId }
                },
                limit: 1
            })
            existingAnalytics = existing.docs.length > 0 ? existing.docs[0] : null
        } else {
            console.log(`Analytics loaded from Redis cache`)
        }

        //CREATE NEW ANALYTICS
        if (!existingAnalytics) {
            console.log(`✨ Creating new analytics for stream ${streamId}`)
            
            let creatorData = null

            //Get creator data from cache or MongoDB (using helper)
            try {
                const creator = await getCreatorCached(payload, stream.creator)
                
                creatorData = {
                    creatorName: creator.channelName || 'Unknown',
                    creatorAvatar: creator.avatar?.url || creator.avatarUrl || null,
                }
                console.log(`👤 Creator data loaded: ${creatorData.creatorName}`)
            } catch (err: any) {
                console.error(`Failed to fetch creator:`, err.message)
                creatorData = {
                    creatorName: 'Unknown',
                    creatorAvatar: null,
                }
            }

            const thumbnailUrl = stream.thumbnail?.url || stream.thumbnailUrl || null

            // Create analytics record in MongoDB
            const newAnalytics = await payload.create({
                collection: 'streamanalytics1',
                data: {
                    stream: streamId,
                    creator: stream.creator,

                    // Denormalized stream data (NO QUERIES NEEDED LATER!)
                    streamTitle: liveInfo.title || stream.title || 'Untitled Stream',
                    streamUrl: liveInfo.streamUrl || stream.streamUrl,
                    thumbnailUrl: thumbnailUrl,

                    //Denormalized creator data (NO QUERIES NEEDED LATER!)
                    creatorName: creatorData.creatorName,
                    creatorAvatar: creatorData.creatorAvatar,

                    platform: stream.platform,
                    startedAt: stream.startedAt || now,
                    isLive: true,

                    //Fixed field names (all plural, camelCase)
                    peakViewers: viewerCount,
                    averageViewers: viewerCount,
                    totalSnapshots: 1,
                    lastUpdated: now,
                },
            })
            
            //Cache the new analytics
            await setCache(cacheKey, newAnalytics, CACHE_TTL.Analytics)
            
            console.log(`✨ Stream Analytics created & cached - ID: ${newAnalytics.id}`)
            console.log(`   📝 Title: "${newAnalytics.streamTitle}"`)
            console.log(`   👤 Creator: ${newAnalytics.creatorName}`)
        } 
        //UPDATE EXISTING ANALYTICS
        else {
            console.log(`Updating existing analytics for stream ${streamId}`)
            
            const analytics = existingAnalytics
            const startTime = analytics.startedAt ? new Date(analytics.startedAt) : undefined
            
            //Get real-time metrics from InfluxDB
            const [peakViewers, averageViewers, snapshotCount] = await Promise.all([
                getPeakViewers1(streamId, startTime, now),
                getAverageViewers1(streamId, startTime, now),
                getSnapshotCount1(streamId, startTime, now),
            ])

            const updateData: any = {
                peakViewers: peakViewers || viewerCount,
                averageViewers: averageViewers || viewerCount,
                totalSnapshots: snapshotCount,
                lastUpdated: now,
                isLive: true,
            }

            // Update stream title if it changed
            if (liveInfo.title && liveInfo.title !== analytics.streamTitle) {
                updateData.streamTitle = liveInfo.title
                console.log(`Stream title updated: "${liveInfo.title}"`)
            }

            // Update in MongoDB
            const updated = await payload.update({
                collection: 'streamanalytics1',
                id: analytics.id,
                data: updateData,
            })
            
            //Update Redis cache
            await setCache(cacheKey, updated, CACHE_TTL.Analytics)
            
            //Invalidate related caches
            await Promise.all([
                deleteCache(CacheKeys.creatorAnalytics(stream.creator, 30)),
                deleteCache(CacheKeys.creatorAnalytics(stream.creator, 7)),
                deleteCache(CacheKeys.trending(10)),
                deleteCache(CacheKeys.liveStreams()),
            ])
            
            console.log(`🔄 Analytics updated & cached - Peak: ${peakViewers}, Avg: ${averageViewers}, Snapshots: ${snapshotCount}`)
        }
    } catch (error: any) {
        console.error(`Analytics Error for stream ${streamId}:`, error.message)
        console.error(error.stack)
        // Don't throw - let the main worker continue even if analytics fail
    }
}

//Function to finalize analytics when stream ends
export async function finalizeStreamAnalytics(
    payload: any,
    streamId: string,
    endedAt: Date
) {
    try {
        console.log(`🏁 Finalizing analytics for stream ${streamId}`)
        
        //Try to get analytics from cache first
        const cacheKey = CacheKeys.analytics(streamId)
        let analytics = await getCache<StreamAnalytics>(cacheKey)
        
        if (!analytics) {
            console.log(`Analytics not in cache, querying MongoDB...`)
            const result = await payload.find({
                collection: 'streamanalytics1',
                where: { stream: { equals: streamId } },
                limit: 1
            })
            analytics = result.docs.length > 0 ? result.docs[0] : null
        } else {
            console.log(`Analytics loaded from Redis cache`)
        }

        if (!analytics) {
            console.log(`No analytics found for stream ${streamId}`)
            return
        }

        //Check if already finalized
        if (analytics.endedAt) {
            console.log(`Analytics already finalized - skipping to avoid re-processing`)
            return
        }

        const startedAt = new Date(analytics.startedAt)

        //Get final metrics from InfluxDB
        const [peakViewers, averageViewers, totalSnapshots] = await Promise.all([
            getPeakViewers1(streamId, startedAt, endedAt),
            getAverageViewers1(streamId, startedAt, endedAt),
            getSnapshotCount1(streamId, startedAt, endedAt)
        ])

        // Calculate duration
        const durationMs = endedAt.getTime() - startedAt.getTime()
        const durationMinutes = Math.round(durationMs / 1000 / 60)

        // Update final analytics in MongoDB
        const finalized = await payload.update({
            collection: 'streamanalytics1',
            id: analytics.id,
            data: {
                endedAt: endedAt,
                peakViewers: peakViewers,
                averageViewers: averageViewers,
                duration: durationMinutes,
                totalSnapshots: totalSnapshots,
                isLive: false,
            },
        })

        //Update cache with finalized data (longer TTL since it won't change)
        await setCache(cacheKey, finalized, CACHE_TTL.Analytics * 10)
        
        //Invalidate all related caches
        const creatorId = typeof analytics.creator === 'string' ? analytics.creator : analytics.creator.id
        await invalidateStreamCaches(streamId, creatorId)

        console.log(`Stream analytics finalized for "${analytics.streamTitle}"`)
        console.log(` Duration: ${durationMinutes} minutes`)
        console.log(`Peak: ${peakViewers}, Avg: ${averageViewers}`)
        console.log(`Total Snapshots: ${totalSnapshots}`)
    } catch (error: any) {
        console.error(`Error finalizing analytics for stream ${streamId}:`, error.message)
        console.error(error.stack)
    }
}