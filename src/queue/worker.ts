// import { Worker, Job } from 'bullmq'
// import { getPayload } from 'payload'
// import { checkYouTubeLiveStatus, checkTwitchLiveStatus, checkKickLiveStatus } from '../utils/livestreamchecker'
// import { uploadImageFromUrl } from '../utils/uploadimage'
// import { Payload } from 'payload'
// import payload from 'payload'
// import {connection} from './stream.queue'

// export type platform =
//     | 'youtube'
//     | 'twitch'
//     | 'kick'
//     | 'rumble'
//     | 'other'
  
// interface StreamCheckJob {
//   creatorId: string
//   platform: platform
//   channelId?: string
//   channelName?: string
// }

// // const connection = {
// //   host: process.env.REDIS_HOST || 'localhost',
// //   port: parseInt(process.env.REDIS_PORT || '6379'),
// // }

// export const startWorker = () => {
//   const worker = new Worker<StreamCheckJob>(
//     'stream-checks',
//     async (job: Job<StreamCheckJob>) => {
//       console.log(` Processing: ${job.data.channelName || job.data.creatorId}`)

//     //   const payload = await getPayload({ config: await import('../../payload.config') })
//       const { creatorId, platform, channelId, channelName } = job.data

//         let liveInfo = null
        

//       // Check if creator is live
//       if (platform === 'youtube' && channelId) {
//         liveInfo = await checkYouTubeLiveStatus(channelId)
//       } else if (platform === 'twitch' && channelName) {
//         liveInfo = await checkTwitchLiveStatus(channelName)
//       } else if (platform === 'kick' && channelName) {
//         liveInfo = await checkKickLiveStatus(channelName)
//       }

//       if (liveInfo && liveInfo.isLive) {
//         console.log(` LIVE: ${channelName}`)
//         // Check if stream already exists
//         const existingStream = await payload.find({
//           collection: 'streams',
//           where: {
//             streamUrl: { equals: liveInfo.streamUrl },
//           },
//         })

//         if (existingStream.docs.length === 0) {
//           // Upload thumbnail
//           let thumbnailId = null
//           if (liveInfo.thumbnail) {
//             thumbnailId = await uploadImageFromUrl(
//               payload,
//               liveInfo.thumbnail,
//               `${channelName}-thumbnail.jpg`
//             )
//           }

//           // Create new stream
//           await payload.create({
//             collection: 'streams',
//             data: {
//               title: liveInfo.title || `${channelName} is live!`,
//               streamUrl: liveInfo.streamUrl!,
//               platform: platform,
//               creator: creatorId,
//               isLive: true,
//               viewerCount: liveInfo.viewerCount || 0,
//               startedAt: liveInfo.startedAt,
//               thumbnail: thumbnailId,
//             },
//           })

//           console.log(` Stream created: ${liveInfo.title}`)
//         } else {
//           // Update existing stream
//           await payload.update({
//             collection: 'streams',
//             id: existingStream.docs[0].id,
//             data: {
//               isLive: true,
//               viewerCount: liveInfo.viewerCount || 0,
//             },
//           })
//           console.log(` Stream updated`)
//         }
//       } else {
//         console.log(` Not live: ${channelName}`)
//       }

//       return { success: true, isLive: liveInfo?.isLive || false }
//     },
//     {
//       connection,
//       concurrency: 5, // Process 5 creators at once
//       limiter: {
//         max: 10, // Max 10 jobs per second
//         duration: 1000,
//       },
//     }
//   )

//   console.log(' Worker started')
//   return worker
// }
import { Worker } from 'bullmq'
import payload from 'payload'
import { connection, StreamCleanupQueue } from '../queue/stream.queue'
import {
  checkYouTubeLiveStatus,
  checkTwitchLiveStatus,
  checkKickLiveStatus,
} from '@/utils/livestreamchecker'
import { uploadImageFromUrl } from '@/utils/uploadimage'
import { getPayload } from 'payload'
import payloadConfig from '@/payload.config'
import { collections } from '@/collections'
import { equal } from 'assert'
import {trackstreamanalytics} from './worker.analytics'
import { T } from 'vitest/dist/chunks/reporters.d.DL9pg5DB.js'

let payloadInstance: any
const getPayloadInstance = async () => {
  if (!payloadInstance) {
    payloadInstance = await getPayload({
      config: payloadConfig
    })
  }
  return payloadInstance
}
export const startWorker = () => {
    const worker= new Worker(
        'stream-check',
        async (job) => {
            const { creatorId, platform, channelId, channelName } = job.data
            const payload = await getPayloadInstance()
            let liveInfo = null
            try {
                if (platform === 'youtube' && channelId) {
                    liveInfo = await checkYouTubeLiveStatus(channelId)
                } else if (platform === 'twitch' && channelName) {
                    liveInfo = await checkTwitchLiveStatus(channelName)
                } else if (platform === 'kick' && channelName) {
                    liveInfo = await checkKickLiveStatus(channelName)
                }
                const existingStreams = await payload.find({
                    collection: 'streams',
                    where: {
                        creator: { equals: creatorId },
                        isLive: { equals: true },
                    },
                    limit: 1,
                })
                const existing = existingStreams.docs[0]
                console.log(` Existing stream found: ${existingStreams ? 'YES' : 'NO'}`)
            
                if (!liveInfo?.isLive) {
                    if (existing) {
                        await payload.update({
                            collection: 'streams',
                            id: existing.id,
                            data: {
                                isLive: false,
                                endedAt: new Date(),
                            },
                        })
                        const analytics = await payload.find({
                            collection: 'Stream-Analytics',
                            where: { stream: { equals: existing.id } },
                            limit:1
                        })
                        if (analytics.docs.length > 0) {
                            await payload.update({
                                collection: 'Stream-Analytics',
                                id: analytics.docs[0].id,
                                data: {
                                    endedAt:new Date(),
                                }
                            })
                        }
                        const cleanupjobId = `cleanup-${existing.id}`
                        const existingCleanupJob = await StreamCleanupQueue.getJob(cleanupjobId)
                        if (!existingCleanupJob) {
                            await StreamCleanupQueue.add(
                                'delete-ended-stream',
                                {
                                    streamId: existing.id,
                                },
                                {
                                    delay: 5 * 60 * 1000,
                                    jobId: cleanupjobId,
                                }
                            )
                            console.log(`⏳ Stream scheduled for deletion in 5 min`)
                        }
                    }
                    return { success: true, isLive: false }
                }

                if (!existing) {
                    let thumbnail = null
                    if (liveInfo.thumbnail) {
                        thumbnail = await uploadImageFromUrl(
                            payload,
                            liveInfo.thumbnail,
                            `${channelName}-stream.jpg`
                        )
                    }

                    const newstream =await payload.create({
                        collection: 'streams',
                        data: {
                            title: liveInfo.title || `${channelName} is live!`,
                            streamUrl: liveInfo.streamUrl!,
                            platform,
                            creator: creatorId,
                            isLive: true,
                            viewerCount: liveInfo.viewerCount || 0,
                            startedAt: liveInfo.startedAt,
                            thumbnail,
                        },
                    })
                    console.log(` Stream created for ${channelName}`)

                    await trackstreamanalytics(payload,newstream.id,newstream,liveInfo)
                }
                else {
                    await payload.update({
                        collection: 'streams',
                        id: existing.id,
                        data: {
                            isLive: true,
                            viewerCount: liveInfo.viewerCount || 0,
                            title: liveInfo.title || existing.title,
                            streamUrl: liveInfo.streamUrl,
                            endedAt:null,
                        }
                    })

                    await trackstreamanalytics(payload, existing.id, existing ,liveInfo)
                // IMPORTANT: Cancel scheduled deletion if stream came back live
                try {
                    const jobToRemove = await StreamCleanupQueue.getJob(`cleanup-${existing.id}`)
                    if (jobToRemove) {
                    await jobToRemove.remove()
                    console.log(`🔄 Cancelled scheduled deletion (stream is live again)`)
                    }
                } catch (err) {
                    // Job might not exist or already processed, that's ok
                }
           }
                return { success: true, isLive: true }
            } catch(error:any) {
                throw error
            }
            },
        {
            connection: connection,
            concurrency: 5,
            limiter: {
                max: 10,
                duration:1000,
            },
        }
    )
    return worker
}
