import { platform } from 'os'
import { CollectionConfig } from 'payload'
import { date, relationship } from 'payload/shared'

export const StreamAnalytics1: CollectionConfig = {
    slug: 'streamanalytics1',
    admin: {
        group: 'Analytics',
        useAsTitle: 'stream',
        defaultColumns:['stream','peakviewers','averageviewers','duration']
    },
    fields: [
        {
            name: 'stream',
            type: 'relationship',
            relationTo: 'streams',
            required: true,
            unique: true     
        },
        {
            name: 'creator',
            type: 'relationship',
            relationTo:'creators1'
        },
        {
            name: 'streamTitle',
            type: 'text',
            required: true,
            admin: {
                description: 'Stream title (stored for quick access)',
            }
        },
        {
            name: 'streamUrl',
            type: 'text',
            admin: {
                description: 'Stream URL (stored for quick access)',
            }
        },
        {
            name: 'thumbnailUrl',
            type: 'text',
            admin: {
                description: 'Thumbnail URL (stored for quick access)',
            }
        },
        // ========================================
        // DENORMALIZED CREATOR DATA (No queries needed!)
        // ========================================
        {
            name: 'creatorName',
            type: 'text',
            required: true,
            admin: {
                description: 'Creator channel name (stored for quick access)',
            }
        },
        { 
            name: 'platform',
            type: 'select',
            required: true,
            options: [
            { label: 'YouTube', value: 'youtube' },
            { label: 'Twitch', value: 'twitch' },
            { label: 'Kick', value: 'kick' },
            { label: 'Rumble', value: 'rumble' },
            { label: 'Others', value: 'others' },
            ],
            admin: {
                description:'Denmormalize for faster searching',
            }
        },
        {
            name: 'peakViewer',
            type: 'number',
            defaultValue: 0,
            admin: {
                description:'Highest viewerCount from snapshots',
            }
        },
        {
            name: 'averageViewers',
            type: 'number',
            defaultValue: 0,
            admin: {
                description:'Average viewer count from influxdb'
            }
        },
        {
            name: 'startedAt',
            type: 'date',
            required:true,
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
            name: 'lastUpdated',
            type: 'date',
            admin: {
                description: 'Last time analytics were calculated',
            },
        },
        {
            name: 'isLive',
            type: 'checkbox',
            defaultValue: false,
            admin: {
                description: 'Is stream currently live',
                position: 'sidebar',
            }
        },
    ],
    hooks: {
        beforeChange: [
            async ({ data, operation }) => {
                if (data.startedAt && data.endedAt) {
                    const start = new Date(data.startedAt).getTime()
                    const end = new Date(data.endedAt).getTime()
                    data.duration=Math.round((end-start)/1000/60)
                }
                return data
            }
        ]
    }
}