import { Banner } from '@payloadcms/ui'
import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    group: 'Media',
  },
  access: {
    read: () => true,
  },
  
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: {
    adminThumbnail: 'thumbnail', 
    staticDir: 'media',
    mimeTypes: ['image/*'],
    imageSizes: [
      {
        name: 'thumbnail',
        width: 300,
        height: 300,
      },
      {
        name: 'banner',
        width: 1024,
        height: 640,
      }
    ]
  },
}
