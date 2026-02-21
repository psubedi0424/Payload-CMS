import { Redis } from 'ioredis'
import { Backoffs, ConnectionOptions, Queue } from 'bullmq'
// import { Queue, QueueRequest }

export const connection:ConnectionOptions = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379',),
    maxRetriesPerRequest:null,

}

export const StreamQueue = new Queue('stream-check',{
    connection ,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
            
        },
        removeOnComplete: true,
        removeOnFail: false,
    }

})

export const StreamCleanupQueue =new Queue('stream-cleanup',{connection})