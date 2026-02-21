import { error } from 'console'
import Redis from 'ioredis'
import { cache } from 'react'

const REDIS_HOST = process.env.REDIS_HOST || 'localhost'
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379')
const REDIS_DB = parseInt(process.env.REDIS_DB || '0')


export const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  db: REDIS_DB,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000)
    return delay
  },
  maxRetriesPerRequest: 3,
})

redis.on('connect', () => {
    console.log('Redis Connected')
})

redis.on('error', (err) => {
    console.log('Error connecting redis')
})
    
redis.on('ready', () => {
    console.log('Redis ready for commands')
})


export const CACHE_TTL = {
    Stream: 60,
    Creator: 120,
    Analytics: 70,
    Trending: 30,
    Platfrom_Status:120,
}

// get data from cache

export async function getCache<T>(key: string): Promise<T | null>{
    try { 
        const data = await redis.get(key)
        if (!data) {
            console.log(`Cache miss:${key}`)
            return null
        }
        console.log(`Cache hit ${key}`)
        return JSON.parse(data)as T
    }
    catch (error: any) {
        console.log('Cache get error for ${key}:', error.message)
        return null
    }
}

export async function setCache(key: string, value: any, ttl: number = CACHE_TTL.Stream): Promise<boolean> {
    try{
        await redis.setex(key, ttl, JSON.stringify(value))
        return true
    }
    catch(error:any){
        console.log(`Cache set error ${key}`)
        return false
    }
}

export async function deleteCache(key:string): Promise < boolean >  {
    
    try{
        await redis.del(key)
        console.log(`cache deleted ${key}`)
        return true
    }
    catch (error: any) {
        console.log(`cache delete failed ${key}`,error.message)
        return false
    }
}

export async function deleteCachePattern(pattern: string): Promise<number> {
  try {
    const keys = await redis.keys(pattern)
    if (keys.length === 0) {
      console.log(` No cache keys found for pattern: ${pattern}`)
      return 0
    }
    const deleted = await redis.del(...keys)
    console.log(` Cache DELETED ${deleted} keys matching: ${pattern}`)
    return deleted
  } catch (error: any) {
    console.error(`Cache pattern delete error for ${pattern}:`, error.message)
    return 0
  }
}

export async function incrementCache(key: string, amount: number = 1): Promise<number> {
  try {
    const value = await redis.incrby(key, amount)
    return value
  } catch (error: any) {
    console.error(`Cache increment error for ${key}:`, error.message)
    return 0
  }
}

export async function setCacheExpireAt(key: string, value: any, expireAt: Date): Promise<boolean> {
  try {
    await redis.set(key, JSON.stringify(value))
    await redis.expireat(key, Math.floor(expireAt.getTime() / 1000))
    console.log(` Cache SET with expiry: ${key} (expires: ${expireAt.toISOString()})`)
    return true
  } catch (error: any) {
    console.error(` Cache expireat error for ${key}:`, error.message)
    return false
  }
}
// ========================================
// CACHE KEY GENERATORS
// ========================================

export const CacheKeys = {
  // Stream cache keys
  stream: (streamId: string) => `stream:${streamId}`,
  streamsByCreator: (creatorId: string) => `streams:creator:${creatorId}`,
  liveStreams: () => 'streams:live',
  
  // Creator cache keys
  creator: (creatorId: string) => `creator:${creatorId}`,
  creatorByChannel: (platform: string, channelId: string) => `creator:${platform}:${channelId}`,
  
  // Analytics cache keys
  analytics: (streamId: string) => `analytics:${streamId}`,
 creatorAnalytics: (creatorId: string, days: number) => `analytics:creator:${creatorId}:${days}d`,
  creatorAnalyticsPattern:(creatorId:string)=>`analytics:creator:${creatorId}:*`,
  
  // Trending & stats cache keys
  trending: (limit: number) => `trending:${limit}`,
  trendingPattern:()=>'trending:*',
  platformStats: (days: number) => `platform:stats:${days}d`,
  
  // Pattern matchers (for bulk delete)
  streamPattern: () => 'stream:*',
  creatorPattern: (creatorId?: string) => creatorId ? `creator:${creatorId}*` : 'creator:*',
  analyticsPattern: (streamId?: string) => streamId ? `analytics:${streamId}*` : 'analytics:*',
}
export async function getCacheOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttl: number = CACHE_TTL.Stream
): Promise<T> {
  // Try cache first
  const cached = await getCache<T>(key)
  if (cached !== null) {
    return cached
  }
  
  // Cache miss - fetch data
  console.log(`⚡ Fetching data for: ${key}`)
  const data = await fetchFn()
  
  // Store in cache
  await setCache(key, data, ttl)
  
  return data
}

//invalidate stream
export async function invalidateStreamCaches(streamId: string, creatorId: string): Promise<void> {
  await Promise.all([
    deleteCache(CacheKeys.stream(streamId)),
    deleteCache(CacheKeys.analytics(streamId)),
    deleteCache(CacheKeys.streamsByCreator(creatorId)),
    deleteCache(CacheKeys.liveStreams()),
    deleteCachePattern(CacheKeys.trendingPattern()),
  ])
  console.log(`🔄 Invalidated caches for stream: ${streamId}`)
}


 // Invalidate creator caches

export async function invalidateCreatorCaches(creatorId: string): Promise<void> {
  await Promise.all([
    deleteCachePattern(CacheKeys.creatorPattern(creatorId)),
    deleteCachePattern(CacheKeys.creatorAnalyticsPattern(creatorId)),
    deleteCache(CacheKeys.streamsByCreator(creatorId)),
  ])
  console.log(`🔄 Invalidated caches for creator: ${creatorId}`)
  
}


/**
 * Check rate limit
 * @returns true if allowed, false if rate limited
 */
export async function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowSeconds: number = 60
): Promise<boolean> {
  const key = `ratelimit:${identifier}`
  const current = await redis.incr(key)
  
  if (current === 1) {
    await redis.expire(key, windowSeconds)
  }
  
  const allowed = current <= maxRequests
  if (!allowed) {
    console.warn(`⚠️ Rate limit exceeded for: ${identifier}`)
  }
  
  return allowed
}

//check redis health
export async function checkRedisHealth(): Promise<boolean> {
  try {
    await redis.ping()
    return true
  } catch (error) {
    return false
  }
}

export default redis