import { operations } from "node_modules/payload/dist/query-presets/types";
import { CollectionConfig } from "payload";
import { relationship } from "payload/shared";
import Stream from "stream";

export const StreamAnalytics: CollectionConfig = {
    slug: 'Stream-Analytics',
    admin: {
        group:'Analytics',
        useAsTitle: 'stream',
        defaultColumns:['stream','peakViewer','averageViewers','duration']
    },
    fields: [
        {
            name: 'stream',
            type: 'relationship',
            relationTo: 'streams',
            required: true,
            unique:true
        },
        {
            name: 'creator',
            type: 'relationship',
            relationTo: 'creators1',
            required:true,
        },
        {
            name: 'platform',
            type: 'select',
            required: true,
            options: ['youtube', 'twitch', 'kick', 'rumble'],
            admin: {
            description: 'Denormalized for faster filtering',
            },
        },
        {
            name: 'viewerSnapshots',
            type: 'array',
            admin: {
                description: 'Viewer count at different times during stream',
            },
            fields: [
                {
                name: 'timestamp',
                type: 'date',
                required: true,
            },
            {
                name: 'viewerCount',
                type: 'number',
                required: true,
            },
            ],
        },
        {
      name: 'peakViewer',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Highest viewer count during stream',
      },
    },
    {
      name: 'averageViewers',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Average viewer count during stream',
      },
        },
    {
      name: 'startedAt',
      type: 'date',
      required: true,
    },
    {
      name: 'endedAt',
      type: 'date',
      admin: {
        description: 'When the stream ended (null if still live)',
      },
    },
    {
      name: 'duration',
      type: 'number',
      admin: {
        description: 'Stream duration in minutes',
      },
    },
    {
      name: 'totalSnapshots',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Number of viewer snapshots taken',
      },
    },
    ],
    hooks: {
        beforeChange: [
            async ({ data, operation }) => {
                if (data.viewerSnapshots && data.viewerSnapshots.length > 0) {
                    const viewers = data.viewerSnapshots.map((s: any) => s.viewerCount)
                    data.peakViewer = Math.max(...viewers)
                    
                    data.averageViewers = Math.round(viewers.reduce((a: number, b: number) => a + b, 0) / viewers.length)
                    
                    data.totalSnapshots=data.viewerSnapshots.length
                }
                if (data.startedAt && data.endedAt) {
                    const start = new Date(data.startedAt).getTime()
                    const end = new Date(data.endedAt).getTime()
                    data.duration =Math.round((end-start)/1000/60)
                }
                return data
            },
        ],
    },
}