import type { PayloadHandler, PayloadRequest } from 'payload';
import { checkYouTubeLiveStatus, checkTwitchLiveStatus, checkKickLiveStatus } from '../utils/livestreamchecker';
import { uploadImageFromUrl } from '@/utils/uploadimage';
import { error } from 'console';

export const autoCreateStreams:PayloadHandler = async (req: PayloadRequest) => {
  try {
    // Get all creators
    const creators = await req.payload.find({
      collection: 'creators1',
      limit: 1000,
    });

    const newStreams = [];

    for (const creator of creators.docs) {
      let liveInfo = null;

      // Check if creator is live based on platform
      if (creator.platform === 'youtube' && creator.channelId) {
        liveInfo = await checkYouTubeLiveStatus(creator.channelId);
      } else if (creator.platform === 'twitch' && creator.channelName) {
        liveInfo = await checkTwitchLiveStatus(creator.channelName);
      } else if (creator.platform === 'kick' && creator.channelName) {
        liveInfo = await checkKickLiveStatus(creator.channelName);
      }

      if (liveInfo && liveInfo.isLive) {
        // Check if stream already exists
        const existingStream = await req.payload.find({
          collection: 'streams',
          where: {
            streamUrl: { equals: liveInfo.streamUrl },
          },
        });

        if (existingStream.docs.length === 0) {
          // Upload thumbnail if available
          let thumbnailId = null;
          if (liveInfo.thumbnail) {
            thumbnailId = await uploadImageFromUrl(
              req.payload,
              liveInfo.thumbnail,
              `${creator.channelName}-stream-thumbnail.jpg`
            );
          }

          // Create new stream record
          const newStream = await req.payload.create({
            collection: 'streams',
            data: {
              title: liveInfo.title || `${creator.channelName} is live!`,
              streamUrl: liveInfo.streamUrl!,
              platform: creator.platform,
              creator: creator.id,
              isLive: true,
              viewerCount: liveInfo.viewerCount || 0,
              startedAt: liveInfo.startedAt,
              thumbnail: thumbnailId,
            },
          });

          newStreams.push(newStream);
        } else {
          // Update existing stream
          await req.payload.update({
            collection: 'streams',
            id: existingStream.docs[0].id,
            data: {
              isLive: true,
              viewerCount: liveInfo.viewerCount || 0,
            },
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Created ${newStreams.length} new stream(s)`,
        streams: newStreams,
      }),
      { status: 200 },
    )
  } catch (err) {
    console.error('Auto create streams failed:', err)

    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      }),
      { status: 503 },
    )
  }
}