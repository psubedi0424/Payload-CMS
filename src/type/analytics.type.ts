// Create this file: src/types/analytics.types.ts

export interface Creator {
  id: string
  channelName?: string
  channelId?: string
  platform: 'youtube' | 'twitch' | 'kick' | 'rumble'
  createdAt: string
  updatedAt: string
}

export interface Stream {
  id: string
  title: string
  streamUrl: string
  platform: 'youtube' | 'twitch' | 'kick' | 'rumble'
  creator: string | Creator
  isLive: boolean
  viewerCount: number
  startedAt: string | Date
  endedAt?: string | Date | null
  thumbnail?: {
    url?: string
  }
  thumbnailUrl?: string
  createdAt: string
  updatedAt: string
}

export interface StreamAnalytics {
  id: string
  stream: string | Stream
  creator: string | Creator
  
  // Denormalized data
  streamTitle: string
  streamUrl: string
  thumbnailUrl?: string | null
  creatorName: string
  
  // Platform & timing
  platform: 'youtube' | 'twitch' | 'kick' | 'rumble'
  startedAt: string | Date
  endedAt?: string | Date | null
  duration?: number | null
  isLive: boolean
  
  // Metrics
  peakViewers: number
  averageViewers: number
  totalSnapshots: number
  lastUpdated: string | Date
  
  // Metadata
  createdAt: string
  updatedAt: string
}

export interface LiveInfo {
  isLive: boolean
  title?: string
  streamUrl?: string
  viewerCount?: number
  thumbnail?: string
  startedAt?: Date
}