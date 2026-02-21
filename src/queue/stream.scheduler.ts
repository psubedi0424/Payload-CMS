// import { QueueScheduler } from 'bullmq'
// import { connection } from './stream.queue'

// export const startStreamSchedulers = () => {
//   console.log('⏱ Starting BullMQ schedulers...')

//   const streamCheckScheduler = new QueueScheduler(
//     'stream-check',
//     { connection }
//   )

//   const streamCleanupScheduler = new QueueScheduler(
//     'stream-cleanup',
//     { connection }
//   )

//   streamCleanupScheduler.on('failed', (jobId:any, err:any) => {
//     console.error(' Scheduler failed:', jobId, err)
//   })

//   console.log(' QueueSchedulers started')

//   return {
//     streamCheckScheduler,
//     streamCleanupScheduler,
//   }
// }
