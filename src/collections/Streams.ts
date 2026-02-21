import { BlocksFeature } from "@payloadcms/richtext-lexical";
import { CollectionConfig } from "payload";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { checkStreamLiveStatus } from "@/utils/livestreamchecker";

export const Streams: CollectionConfig = {
    slug: 'streams',
  admin: {
      group: 'Content',
        useAsTitle: 'title',
    },
    hooks: {
        afterRead: [
            async ({ doc, req }) => {
            if (!doc) return doc;
            const islive =await checkStreamLiveStatus(doc.streamUrl, doc.platform);
             return {
                ...doc,
                doILikeIt: ['gaming','tech','music'].some(word => 
                  doc.title?.includes(word)),
                isLive: islive
            };
            }
        ],
},
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'streamUrl',
      type: 'text',
      required: true,
    },
    {
      name: 'platform',
      type: 'select',
      required: true,
      options: ['youtube', 'twitch', 'kick', 'rumble','other',],
    },
    {
      name: 'creator',
      type: 'relationship',
      relationTo: 'creators',
      required: true,
    },
    {
      name: 'isLive',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
        description: 'Auto-updated based on platform API',
      },
    },
    {
      name: 'viewerCount',
      type: 'number',
      admin: {
        description: 'Current viewer count',
      },
    },
    {
      name: 'startedAt',
      type: 'date',
      admin: {
        description: 'When the stream started',
      },
    },
    {
      name: 'thumbnail',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'media',
    },
    {
    name: 'endedAt',
    type: 'date',
    admin: {
      description: 'When the stream ended',
      },
    },
    {
      name: 'content',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ defaultFeatures }) => [
          ...defaultFeatures,
          BlocksFeature({
            blocks: [
              {
                slug: 'highlight',
                labels: {
                  singular: 'Highlight',
                  plural: 'Highlights',
                },
                fields: [
                  {
                    name: 'text',
                    type: 'text',
                    required: true,
                  },
                ],
              },
              {
                slug: 'imageBlock',
                labels: {
                  singular: 'Image Block',
                  plural: 'Image Blocks',
                },
                fields: [
                  {
                    name: 'image',
                    type: 'upload',
                    relationTo: 'media',
                    required: true,
                  },
                  {
                    name: 'caption',
                    type: 'text',
                  },
                ],
              },
            ],
          }),
        ],
      }),
    },
  ],
};