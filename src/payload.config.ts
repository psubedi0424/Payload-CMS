import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { BlocksFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { collections } from './collections/index'
import { autoCreateStreams } from './endpoints/autocreatestreams'
import type {PayloadRequest } from 'payload'
// import { startStreamCron } from './cron/stream.cron'
import { initializeStreamChecker } from './queue'
import { startStreamCron } from './cron/stream.cron'
import { systemStatus } from './endpoints/streamstatus'
import { triggerCheck } from './endpoints/triggercheck'
import { getCreatorAnalytics, getPlatformStats, getTrendingStreams } from './endpoints/analytics'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    components: {
      // Import your custom CSS through a component
      beforeDashboard: ['./components/CustomStyles'],
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  endpoints: [
    {
      path: '/auto-create-streams',
    method: 'post',
      handler: autoCreateStreams,
      // handler: async (req:PayloadRequest, res:any) => {
      //  const { autoCreateStreams } = await import('./endpoints/autocreatestreams.js')
      //   return autoCreateStreams(req, res)}
      
    },
    {
    path: '/system-status',
    method: 'get',
    handler: systemStatus,
    },
    {
    path: '/trigger-check',
    method: 'post',
    handler: triggerCheck as any,
    },
    {
    path: '/analytics/creator',
    method: 'get',
    handler: getCreatorAnalytics,
  },
  {
    path: '/analytics/platforms',
    method: 'get',
    handler: getPlatformStats,
  },
  {
    path: '/analytics/trending',
    method: 'get',
    handler: getTrendingStreams,
  },
  ],
  collections,
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URL || '',
  }),
  sharp,
  plugins: [],
  onInit: async () => {
    console.log('🚀 Payload initialized, starting workers...')
    await initializeStreamChecker()
    // startStreamCron
  },

})
