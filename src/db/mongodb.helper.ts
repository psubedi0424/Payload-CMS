import { getCache, setCache, CacheKeys, CACHE_TTL, getCacheOrFetch } from './redis.config'

/**
 * Get stream with caching
 */
export async function getStreamCached(payload: any, streamId: string) {
  return getCacheOrFetch(
    CacheKeys.stream(streamId),
    async () => {
      const stream = await payload.findByID({
        collection: 'streams',
        id: streamId,
      })
      return stream
    },
    CACHE_TTL.Stream
  )
}

/**
 * Get creator with caching
 */
export async function getCreatorCached(payload: any, creatorId: string) {
  return getCacheOrFetch(
    CacheKeys.creator(creatorId),
    async () => {
      const creator = await payload.findByID({
        collection: 'creators1',
        id: creatorId,
      })
      return creator
    },
    CACHE_TTL.Creator
  )
}

/**
 * Get live streams with caching
 */
export async function getLiveStreamsCached(payload: any) {
  return getCacheOrFetch(
    CacheKeys.liveStreams(),
    async () => {
      const streams = await payload.find({
        collection: 'streams',
        where: {
          isLive: { equals: true }
        },
        limit: 100,
      })
      return streams.docs
    },
    CACHE_TTL.Stream
  )
}

/**
 * Get streams by creator with caching
 */
export async function getStreamsByCreatorCached(payload: any, creatorId: string) {
  return getCacheOrFetch(
    CacheKeys.streamsByCreator(creatorId),
    async () => {
      const streams = await payload.find({
        collection: 'streams',
        where: {
          creator: { equals: creatorId },
          isLive: { equals: true }
        },
        limit: 10,
      })
      return streams.docs
    },
    CACHE_TTL.Stream
  )
}

/**
 * Get analytics with caching
 */
export async function getAnalyticsCached(payload: any, streamId: string) {
  return getCacheOrFetch(
    CacheKeys.analytics(streamId),
    async () => {
      const analytics = await payload.find({
        collection: 'streamanalytics1',
        where: {
          stream: { equals: streamId }
        },
        limit: 1,
      })
      return analytics.docs[0] || null
    },
    CACHE_TTL.Analytics
  )
}

/**
 * Get creator analytics with caching
 */
export async function getCreatorAnalyticsCached(
  payload: any,
  creatorId: string,
  days: number = 30
) {
  return getCacheOrFetch(
    CacheKeys.creatorAnalytics(creatorId, days),
    async () => {
      const daysAgo = new Date()
      daysAgo.setDate(daysAgo.getDate() - days)

      const analytics = await payload.find({
        collection: 'streamanalytics1',
        where: {
          and: [
            { creator: { equals: creatorId } },
            { startedAt: { greater_than_equal: daysAgo.toISOString() } },
          ],
        },
        limit: 1000,
      })
      return analytics.docs
    },
    CACHE_TTL.Analytics
  )
}

/**
 * Create stream and invalidate cache
 */
export async function createStreamWithCache(payload: any, data: any) {
  const stream = await payload.create({
    collection: 'streams',
    data,
  })
  
  // Invalidate related caches
  await Promise.all([
    setCache(CacheKeys.stream(stream.id), stream, CACHE_TTL.Stream),
    // Invalidate lists
    require('./redis.config').deleteCache(CacheKeys.liveStreams()),
    require('./redis.config').deleteCache(CacheKeys.streamsByCreator(data.creator)),
  ])
  
  return stream
}

/**
 * Update stream and invalidate cache
 */
export async function updateStreamWithCache(payload: any, streamId: string, data: any) {
  const stream = await payload.update({
    collection: 'streams',
    id: streamId,
    data,
  })
  
  // Update cache
  await setCache(CacheKeys.stream(streamId), stream, CACHE_TTL.Stream)
  
  // Invalidate related caches
  await Promise.all([
    require('./redis.config').deleteCache(CacheKeys.liveStreams()),
    require('./redis.config').deleteCache(CacheKeys.streamsByCreator(stream.creator)),
    require('./redis.config').deleteCachePattern(CacheKeys.trendingPattern()),
  ])
  
  return stream
}

/**
 * Batch get creators with caching
 */
export async function getCreatorsBatchCached(payload: any, creatorIds: string[]) {
  const creators: any[] = []
  const missingIds: string[] = []
  
  // Check cache first
  for (const id of creatorIds) {
    const cached = await getCache(CacheKeys.creator(id))
    if (cached) {
      creators.push(cached)
    } else {
      missingIds.push(id)
    }
  }
  
  // Fetch missing from DB
  if (missingIds.length > 0) {
    const result = await payload.find({
      collection: 'creators1',
      where: {
        id: { in: missingIds }
      },
      limit: missingIds.length,
    })
    
    // Cache and add to results
    for (const creator of result.docs) {
      await setCache(CacheKeys.creator(creator.id), creator, CACHE_TTL.Creator)
      creators.push(creator)
    }
  }
  
  return creators
}