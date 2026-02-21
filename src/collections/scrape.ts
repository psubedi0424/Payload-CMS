import { CollectionConfig } from 'payload'
import getYouTubeID from 'get-youtube-id'
import { uploadImageFromUrl } from '@/utils/uploadimage'
import { checkKickLiveStatus, checkTwitchLiveStatus, checkYouTubeLiveStatus } from '@/utils/livestreamchecker'
import { StreamQueue } from '@/queue/stream.queue'

type ChannelIdentifier =
  | { type: 'channelId'; value: string }
  | { type: 'handle'; value: string }
  | { type: 'custom'; value: string }
  | { type: 'user'; value: string }
  | { type: 'videoId'; value: string }

const extractChannelIdentifier = (url: string): ChannelIdentifier | null => {
  try {
    const parsed = new URL(url)

    const videoId = getYouTubeID(url)
    if (videoId) {
      return { type: 'videoId', value: videoId }
    }
    if (parsed.pathname.startsWith('/channel/')) {
      return { type: 'channelId', value: parsed.pathname.split('/')[2] }
    }

    if (parsed.pathname.startsWith('/@')) {
      return { type: 'handle', value: parsed.pathname.replace('/', '') }
    }

    if (parsed.pathname.startsWith('/c/')) {
      return { type: 'custom', value: parsed.pathname.split('/')[2] }
    }

    if (parsed.pathname.startsWith('/user/')) {
      return { type: 'user', value: parsed.pathname.split('/')[2] }
    }

    return null
  } catch (err) {
    console.error('Invalid URL:', err)
    return null
  }
}

const resolveChannelId = async (identifier: ChannelIdentifier): Promise<string | null> => {
  if (identifier.type === 'channelId') {
    return identifier.value
  }
  
  if (identifier.type === 'videoId') {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${identifier.value}&key=${process.env.YOUTUBE_API_KEY}`
      )
      const data = await res.json()
      return data.items?.[0]?.snippet?.channelId ?? null
    } catch (err) {
      console.error('Failed to get channel from video:', err)
      return null
    }
  }
  
  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${identifier.value}&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`
    )
    const data = await res.json()
    return data.items?.[0]?.snippet?.channelId ?? null
  } catch (err) {
    console.error('Failed to resolve channel ID:', err)
    return null
  }
}

const fetchChannelInfo = async (url: string): Promise<{
  channelId?: string
  channelName?: string
  channelLogo?: string
  description?: string
} | null> => {
  try {
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) return null

    const identifier = extractChannelIdentifier(url)
    if (!identifier) return null

    const channelId = await resolveChannelId(identifier)
    if (!channelId) return null

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${process.env.YOUTUBE_API_KEY}`
    )

    const data = await response.json()
    const channel = data.items?.[0]

    if (!channel) return null

    return {
      channelId,
      channelName: channel.snippet.title,
      channelLogo: channel.snippet.thumbnails.high?.url,
      description: channel.snippet.description,
    }
  } catch (err) {
    console.error('Channel fetch failed:', err)
    return null
  }
}

export const Creators1: CollectionConfig = {
  slug: 'creators1',
  admin: {
    group: 'Content',
    useAsTitle: 'channelName',
  },
  hooks: {
    beforeValidate: [
      async ({ data, operation, req }) => {
        // Only check on create operation
        if (operation !== 'create') {
          return data
        }

        if (!data?.channelUrl) {
          return data
        }

        console.log(' Checking if creator already exists...')

        // First, get the channel ID from the URL
        const channelInfo = await fetchChannelInfo(data.channelUrl)
        
        if (!channelInfo?.channelId) {
          console.log(' Could not extract channel ID')
          return data
        }

        // Check if a creator with this channelId already exists
        const existingCreator = await req.payload.find({
          collection: 'creators1',
          where: {
            channelId: {
              equals: channelInfo.channelId,
            },
          },
          limit: 1,
        })

        if (existingCreator.docs.length > 0) {
          const existing = existingCreator.docs[0] as any
          console.log(' Creator already exists:', existing.channelName)
          
          // Throw an error to prevent creation
          throw new Error(
            `This creator already exists: "${existing.channelName}". Please edit the existing creator instead.`
          )
        }

        console.log(' Creator does not exist, proceeding...')
        return data
      },
    ],
    beforeChange: [
      async ({ data, operation, req, originalDoc }) => {
        // Only fetch on create OR when URL changes
        const shouldFetch = 
          operation === 'create' || 
          (originalDoc && data.channelUrl && data.channelUrl !== originalDoc.channelUrl)

        if (!data?.channelUrl || !shouldFetch) {
          return data
        }

        console.log(' Fetching channel info...')
        const channelInfo = await fetchChannelInfo(data.channelUrl)

        if (!channelInfo) {
          console.log(' Could not fetch channel info')
          return data
        }

        console.log(' Fetched:', channelInfo.channelName)

        // Upload logo only if we don't have one
        let channelLogoId = data.channelLogo
        if (channelInfo.channelLogo && req.payload && !data.channelLogo) {
          console.log(' Uploading logo...')
          channelLogoId = await uploadImageFromUrl(
            req.payload,
            channelInfo.channelLogo,
            `${channelInfo.channelName || 'channel'}-logo.jpg`
          )
        }

        return {
          ...data,
          channelId: channelInfo.channelId,
          channelName: channelInfo.channelName ?? data.channelName,
          channelLogo: channelLogoId,
          fetchedLogoUrl: channelInfo.channelLogo,
          description: channelInfo.description,
        }
      },
    ],
    
    afterRead: [
      async ({ doc }) => {
        if (!doc) return doc

        
        let liveStreamInfo = null

        if (doc.platform === 'youtube' && doc.channelId) {
          liveStreamInfo = await checkYouTubeLiveStatus(doc.channelId)
        } else if (doc.platform === 'twitch' && doc.channelName) {
          liveStreamInfo = await checkTwitchLiveStatus(doc.channelName)
        } else if (doc.platform === 'kick' && doc.channelName) {
          liveStreamInfo = await checkKickLiveStatus(doc.channelName)
        }
        return {
          ...doc,
          isLive: liveStreamInfo?.isLive || false,
          currentStream: liveStreamInfo?.isLive ? liveStreamInfo : null,
        }
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
    if (operation === 'create') {
      // // Check if live immediately
      // const { streamCheckQueue } = await import('../queue/config')
      
      await StreamQueue.add('check-creator', {
        creatorId: doc.id,
        platform: doc.platform,
        channelId: doc.channelId,
        channelName: doc.channelName,
      }, {
        priority: 1,
      })

      console.log(' Queued immediate live check for new creator')
    }

    return doc
  },
    ]
  },
  fields: [
    {
      name: 'channelName',
      type: 'text',
      admin: {
        description: 'Auto-filled from YouTube',
      },
    },
    {
      name: 'platform',
      type: 'select',
      required: true,
      defaultValue: 'youtube',
      options: [
        { label: 'YouTube', value: 'youtube' },
        { label: 'Twitch', value: 'twitch' },
        { label: 'Kick', value: 'kick' },
        { label: 'Rumble', value: 'rumble' },
        { label: 'Other', value: 'other' },
      ],
      admin: {
        description: 'Select the streaming platform',
      },
    },
    {
      name: 'channelUrl',
      type: 'text',
      label: 'Channel or Video URL',
      admin: {
        description: 'Paste a YouTube channel URL or video URL',
      },
    },
    {
      name: 'channelId',
      type: 'text',
      unique: true,
      admin: {
        readOnly: true,
        description: 'Auto-extracted channel ID',
      },
    },
    {
      name: 'channelLogo',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Auto-uploaded from YouTube',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Auto-filled from YouTube',
      },
    },
    {
      name: 'fetchedLogoUrl',
      type: 'text',
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
  ],
}