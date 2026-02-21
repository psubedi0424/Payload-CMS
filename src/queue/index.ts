import { startWorker } from './worker'
import { startStreamCron } from '../cron/stream.cron'
import { startStreamCleanupWorker } from './streamcleanup.worker'
import { startWorker1 } from './worker1'

export const initializeStreamChecker = async () => {
  console.log(' Initializing stream checker...')


  // Start worker
  // const worker = startWorker()
  const worker1=startWorker1()
  console.log("Worker started.")
  const cleanupworker = startStreamCleanupWorker()
  console.log("Stream cleanup started")
  
  // Start cron
  await startStreamCron()
    

  console.log(' Stream checker initialized!')

  // Cleanup on exit
  process.on('SIGTERM', async () => {
    console.log(' Shutting down...')
    // await worker.close()
    await worker1.close()
    await cleanupworker.close()
    process.exit(0)
  })
}