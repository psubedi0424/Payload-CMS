import { CollectionConfig } from 'payload';
import { uploadImageFromUrl } from '@/utils/uploadimage';
import { checkYouTubeLiveStatus, checkTwitchLiveStatus, checkKickLiveStatus } from '../utils/livestreamchecker';
import getYouTubeID from 'get-youtube-id';
type ChannelIdentifier =
  | { type: 'channelId'; value: string }
  | { type: 'handle'; value: string }
  | { type: 'custom'; value: string }
  | { type: 'user'; value: string }
  | { type: 'videoId'; value: string };

const extractChannelIdentifier = (url: string): ChannelIdentifier | null => {
  const parsed = new URL(url);

  const videoId = getYouTubeID(url);
  if (videoId) {
    return { type: 'videoId', value: videoId };
  }

  if (parsed.pathname.startsWith('/channel/')) {
    return { type: 'channelId', value: parsed.pathname.split('/')[2] };
  }

  if (parsed.pathname.startsWith('/@')) {
    return { type: 'handle', value: parsed.pathname.replace('/', '') };
  }

  if (parsed.pathname.startsWith('/c/')) {
    return { type: 'custom', value: parsed.pathname.split('/')[2] };
  }

  if (parsed.pathname.startsWith('/user/')) {
    return { type: 'user', value: parsed.pathname.split('/')[2] };
  }

  return null;
};

const resolveChannelId = async (identifier: ChannelIdentifier): Promise<string | null> => {
  if (identifier.type === 'channelId') {
    return identifier.value;
  }

  if (identifier.type === 'videoId') {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${identifier.value}&key=${process.env.YOUTUBE_API_KEY}`
      );
      const data = await res.json();
      return data.items?.[0]?.snippet?.channelId ?? null;
    } catch (err) {
      console.error('Failed to get channel from video:', err);
      return null;
    }
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${identifier.value}&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`
    );
    const data = await res.json();
    return data.items?.[0]?.snippet?.channelId ?? null;
  } catch (err) {
    console.error('Failed to resolve channel ID:', err);
    return null;
  }
};

const fetchChannelInfo = async (url: string): Promise<{
  channelName?: string;
  channelLogo?: string;
  description?: string;
  channelId?: string;
} | null> => {
  try {
    if (!url.includes('youtube.com')) return null;

    const identifier = extractChannelIdentifier(url);
    if (!identifier) return null;

    const channelId = await resolveChannelId(identifier);
    if (!channelId) return null;

    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${process.env.YOUTUBE_API_KEY}`
    );

    const data = await response.json();
    const channel = data.items?.[0];

    if (!channel) return null;

    return {
      channelName: channel.snippet.title,
      channelLogo: channel.snippet.thumbnails.high?.url,
      description: channel.snippet.description,
      channelId,
    };
  } catch (err) {
    console.error('Channel fetch failed:', err);
    return null;
  }
};

export const Creators: CollectionConfig = {
  slug: 'creators',
  admin: {
    group: 'Content',
    useAsTitle: 'channelName',
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        if (!data?.channelUrl || operation !== 'create') {
          return data;
        }

        const channelInfo = await fetchChannelInfo(data.channelUrl);

        if (!channelInfo) {
          return data;
        }

        let channelLogoId = data.channelLogo;
        if (channelInfo.channelLogo && req.payload) {
          channelLogoId = await uploadImageFromUrl(
            req.payload,
            channelInfo.channelLogo,
            `${channelInfo.channelName || 'channel'}-logo.jpg`
          );
        }

        return {
          ...data,
          channelName: channelInfo.channelName ?? data.channelName,
          channelLogo: channelLogoId,
          channelId: channelInfo.channelId,
          fetchedLogoUrl: channelInfo.channelLogo,
          description: channelInfo.description,
        };
      },
    ],
    afterRead: [
      async ({ doc, req }) => {
        if (!doc) return doc;

        // Check if creator is currently live
        let liveStreamInfo = null;

        if (doc.platform === 'youtube' && doc.channelId) {
          liveStreamInfo = await checkYouTubeLiveStatus(doc.channelId);
        } else if (doc.platform === 'twitch' && doc.channelName) {
          liveStreamInfo = await checkTwitchLiveStatus(doc.channelName);
        } else if (doc.platform === 'kick' && doc.channelName) {
          liveStreamInfo = await checkKickLiveStatus(doc.channelName);
        }

        return {
          ...doc,
          isLive: liveStreamInfo?.isLive || false,
          currentStream: liveStreamInfo?.isLive ? liveStreamInfo : null,
        };
      },
    ],
  },
  fields: [
    {
      name: 'channelName',
      type: 'text',
      admin: {
        description: 'Auto-filled from channel URL',
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
    },
    {
      name: 'channelUrl',
      type: 'text',
      label: 'Channel or Video URL',
      required: true,
    },
    {
      name: 'channelId',
      type: 'text',
      admin: {
        readOnly: true,
        description: 'Auto-extracted YouTube channel ID',
      },
    },
    {
      name: 'channelLogo',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Auto-filled from platform',
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
};