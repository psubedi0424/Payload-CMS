// import { collections } from "@/collections"
// import { timeStamp } from "console"
// import { platform } from "os"

 export async function trackstreamanalytics(
    payload: any,
    streamId: string, 
    stream: any,
    liveInfo:any
) {
     try {
         const now = new Date()
            
        const existing= await payload.find({
            collection: 'Stream-Analytics',
            where: {
                stream: { equals: streamId }
            },
            limit:1
        })
        const viewerSnapshots = {
        timestamp: now,
        viewerCount: liveInfo.viewerCount || 0,
        }
        if (existing.docs.length === 0) {
            await payload.create({
                collection: 'Stream-Analytics',
                data: {
                    stream: streamId,
                    creator: stream.creator,
                    platform: stream.platform,
                    startedAt: stream.startedAt || now,
                    viewerSnapshots: [viewerSnapshots],
                },
            })
            console.log('Stream Analytic created')
        }
         //update existing analytics
        else {
            const analytics = existing.docs[0]
            //add new snapshot to existing ones
            const newSnapShot = [
                ...(analytics.viewerSnapshots || []),
                {
                    timestamp: now ,
                    viewerCount: liveInfo.viewerCount|| 0,
                },
            ]
            await payload.update({
                collection: 'Stream-Analytics',
                id: analytics.id,
                data: {
                    viewerSnapshots:newSnapShot,
                }
            })
            const totalSnapshots=(analytics.viewerSnapshots?.length||0)+1
            console.log(`Analytics updated (${newSnapShot.length}) snapshots`)
        }
     }
    catch (error: any) {
        console.log('Analytics Error:', error.message)
    }
}