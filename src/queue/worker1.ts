import { Worker } from 'bullmq'
import { connection, StreamCleanupQueue } from '../queue/stream.queue'
import {
  checkYouTubeLiveStatus,
  checkTwitchLiveStatus,
  checkKickLiveStatus,
} from '@/utils/livestreamchecker'
import { uploadImageFromUrl } from '@/utils/uploadimage'
import { getPayload } from 'payload'
import payloadConfig from '@/payload.config'
import { trackstreamanalytics, finalizeStreamAnalytics } from './worker.analytics1'

let payloadInstance: any
const getPayloadInstance = async () => {
  if (!payloadInstance) {
    payloadInstance = await getPayload({
      config: payloadConfig
    })
  }
  return payloadInstance
}

export const startWorker1 = () => {
    const worker = new Worker(
        'stream-check',
        async (job) => {
            const { creatorId, platform, channelId, channelName } = job.data
            const payload = await getPayloadInstance()
            let liveInfo = null
            
            try {
                // Check live status based on platform
                if (platform === 'youtube' && channelId) {
                    liveInfo = await checkYouTubeLiveStatus(channelId)
                } else if (platform === 'twitch' && channelName) {
                    liveInfo = await checkTwitchLiveStatus(channelName)
                } else if (platform === 'kick' && channelName) {
                    liveInfo = await checkKickLiveStatus(channelName)
                }

                // Find existing live stream
                const existingStreams = await payload.find({
                    collection: 'streams',
                    where: {
                        creator: { equals: creatorId },
                        isLive: { equals: true },
                    },
                    limit: 1,
                })
                
                const existing = existingStreams.docs[0]
                console.log(`✅ Existing stream found: ${existing ? 'YES' : 'NO'}`)
            
                // Handle stream going offline
                if (!liveInfo?.isLive) {
                    if (existing) {
                        console.log(`📴 Stream went offline for ${channelName}`)
                        
                        const endedAt = new Date()
                        
                        // Update stream to offline
                        await payload.update({
                            collection: 'streams',
                            id: existing.id,
                            data: {
                                isLive: false,
                                endedAt: endedAt,
                            },
                        })

                        // Finalize analytics in InfluxDB
                        await finalizeStreamAnalytics(payload, existing.id, endedAt)

                        // Schedule cleanup job
                        const cleanupJobId = `cleanup-${existing.id}`
                        const existingCleanupJob = await StreamCleanupQueue.getJob(cleanupJobId)
                        
                        if (!existingCleanupJob) {
                            await StreamCleanupQueue.add(
                                'delete-ended-stream',
                                { streamId: existing.id },
                                {
                                    delay: 5 * 60 * 1000, // 5 minutes
                                    jobId: cleanupJobId,
                                }
                            )
                            console.log(`⏳ Stream scheduled for deletion in 5 minutes`)
                        }
                    }
                    return { success: true, isLive: false }
                }

                // Handle new stream
                if (!existing) {
                    console.log(`🎥 New stream detected for ${channelName}`)
                    
                    let thumbnail = null
                    if (liveInfo.thumbnail) {
                        thumbnail = await uploadImageFromUrl(
                            payload,
                            liveInfo.thumbnail,
                            `${channelName}-stream.jpg`
                        )
                    }

                    const newstream = await payload.create({
                        collection: 'streams',
                        data: {
                            title: liveInfo.title || `${channelName} is live!`,
                            streamUrl: liveInfo.streamUrl!,
                            platform,
                            creator: creatorId,
                            isLive: true,
                            viewerCount: liveInfo.viewerCount || 0,
                            startedAt: liveInfo.startedAt || new Date(),
                            thumbnail,
                        },
                    })
                    console.log(`✨ Stream created for ${channelName}`)

                    // Track analytics (writes to InfluxDB+ create payloadcms recorx)
                    await trackstreamanalytics(payload, newstream.id, newstream, liveInfo)
                } 
                // Handle existing stream update
                else {
                    console.log(`🔄 Updating existing stream for ${channelName}`)
                    
                    await payload.update({
                        collection: 'streams',
                        id: existing.id,
                        data: {
                            isLive: true,
                            viewerCount: liveInfo.viewerCount || 0,
                            title: liveInfo.title || existing.title,
                            streamUrl: liveInfo.streamUrl,
                            endedAt: null,
                        }
                    })

                    // Track analytics (writes to InfluxDB+update)
                    await trackstreamanalytics(payload, existing.id, existing, liveInfo)
                    
                    // Cancel scheduled deletion if stream came back live
                    try {
                        const cleanupJobId = `cleanup-${existing.id}`
                        const jobToRemove = await StreamCleanupQueue.getJob(cleanupJobId)
                        if (jobToRemove) {
                            await jobToRemove.remove()
                            console.log(`🔄 Cancelled scheduled deletion (stream is live again)`)
                        }
                    } catch (err) {
                        console.log(`ℹ️  No cleanup job to cancel`)
                    }
                }

                return { success: true, isLive: true }
                
            } catch (error: any) {
                console.error(`❌ Worker error for ${channelName}:`, error.message)
                throw error
            }
        },
        {
            connection: connection,
            concurrency: 5,
            limiter: {
                max: 10,
                duration: 1000,
            },
        }
    )

    worker.on('completed', (job) => {
        console.log(`✅ Job ${job.id} completed`)
    })

    worker.on('failed', (job, err) => {
        console.error(`❌ Job ${job?.id} failed:`, err.message)
    })

    return worker
}