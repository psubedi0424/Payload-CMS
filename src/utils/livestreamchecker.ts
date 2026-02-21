export interface LiveStreamInfo {
  isLive: boolean;
  streamUrl?: string;
  title?: string;
  thumbnail?: string;
  viewerCount?: number;
  startedAt?: string;
  description?: string;
  channelId?: string;
  videoId?: string;
}

/**
 * Check if a YouTube channel is currently live
 */
export async function checkYouTubeLiveStatus(
  channelId: string
): Promise<LiveStreamInfo> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?` +
      `part=snippet&channelId=${channelId}&eventType=live&type=video&key=${process.env.YOUTUBE_API_KEY}`
    );

    const data = await response.json();

    if (data.items && data.items.length > 0) {
      const liveStream = data.items[0];
      const videoId = liveStream.id.videoId;

      // Get additional details including viewer count
      const videoResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?` +
        `part=snippet,liveStreamingDetails,statistics&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`
      );

      const videoData = await videoResponse.json();
      const video = videoData.items?.[0];

      return {
        isLive: true,
        streamUrl: `https://www.youtube.com/watch?v=${videoId}`,
        videoId,
        title: video?.snippet?.title || liveStream.snippet.title,
        thumbnail: video?.snippet?.thumbnails?.high?.url || liveStream.snippet.thumbnails.high.url,
        viewerCount: parseInt(video?.liveStreamingDetails?.concurrentViewers || '0'),
        startedAt: video?.liveStreamingDetails?.actualStartTime || liveStream.snippet.publishedAt,
        description: video?.snippet?.description,
        channelId,
      };
    }

    return { isLive: false };
  } catch (err) {
    console.error('YouTube live check failed:', err);
    return { isLive: false };
  }
}

/**
 * Check if a Twitch channel is currently live
 */
export async function checkTwitchLiveStatus(
  channelName: string
): Promise<LiveStreamInfo> {
  try {
    // First, get user ID from username
    const userResponse = await fetch(
      `https://api.twitch.tv/helix/users?login=${channelName}`,
      {
        headers: {
          'Client-ID': process.env.TWITCH_CLIENT_ID!,
          'Authorization': `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`,
        },
      }
    );

    const userData = await userResponse.json();
    const userId = userData.data?.[0]?.id;

    if (!userId) return { isLive: false };

    // Check if user is streaming
    const streamResponse = await fetch(
      `https://api.twitch.tv/helix/streams?user_id=${userId}`,
      {
        headers: {
          'Client-ID': process.env.TWITCH_CLIENT_ID!,
          'Authorization': `Bearer ${process.env.TWITCH_ACCESS_TOKEN}`,
        },
      }
    );

    const streamData = await streamResponse.json();
    const stream = streamData.data?.[0];

    if (stream) {
      return {
        isLive: true,
        streamUrl: `https://www.twitch.tv/${channelName}`,
        title: stream.title,
        thumbnail: stream.thumbnail_url?.replace('{width}', '1920').replace('{height}', '1080'),
        viewerCount: stream.viewer_count,
        startedAt: stream.started_at,
        description: stream.game_name,
      };
    }

    return { isLive: false };
  } catch (err) {
    console.error('Twitch live check failed:', err);
    return { isLive: false };
  }
}

/**
 * Check if a Kick channel is currently live
 */
export async function checkKickLiveStatus(
  channelName: string
): Promise<LiveStreamInfo> {
  try {
    const response = await fetch(`https://kick.com/api/v2/channels/${channelName}`);
    const data = await response.json();

    if (data.livestream) {
      return {
        isLive: true,
        streamUrl: `https://kick.com/${channelName}`,
        title: data.livestream.session_title,
        thumbnail: data.livestream.thumbnail?.url,
        viewerCount: data.livestream.viewer_count || 0,
        startedAt: data.livestream.created_at,
        description: data.livestream.categories?.[0]?.name,
      };
    }

    return { isLive: false };
  } catch (err) {
    console.error('Kick live check failed:', err);
    return { isLive: false };
  }
}

/**
 * Universal function to check stream status for any platform
 */
export async function checkStreamLiveStatus(
  streamUrl: string,
  platform: string
): Promise<boolean> {
  try {
    if (platform === 'youtube') {
      // Extract video ID and check if it's live
      const videoId = await extractYouTubeVideoId(streamUrl);
      if (!videoId) return false;

      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?` +
        `part=snippet,liveStreamingDetails&id=${videoId}&key=${process.env.YOUTUBE_API_KEY}`
      );

      const data = await response.json();
      const video = data.items?.[0];
      
      return video?.snippet?.liveBroadcastContent === 'live';
    }

    if (platform === 'twitch') {
      const channelName = extractTwitchUsername(streamUrl);
      if (!channelName) return false;
      
      const status = await checkTwitchLiveStatus(channelName);
      return status.isLive;
    }

    if (platform === 'kick') {
      const channelName = extractKickUsername(streamUrl);
      if (!channelName) return false;
      
      const status = await checkKickLiveStatus(channelName);
      return status.isLive;
    }

    return false;
  } catch (err) {
    console.error('Stream status check failed:', err);
    return false;
  }
}

// Helper functions to extract usernames/IDs from URLs
function extractYouTubeVideoId(url: string): string | null {
  const regex = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/)([^&\s]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function extractTwitchUsername(url: string): string | null {
  const regex = /twitch\.tv\/([^\/\s]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

function extractKickUsername(url: string): string | null {
  const regex = /kick\.com\/([^\/\s]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}