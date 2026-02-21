import { isAdmin, isAdminField, isEditorField } from '@/access/is_admin'
import type { CollectionConfig } from 'payload'
import { is } from 'payload/i18n/is'

export const Users: CollectionConfig = {
  slug: 'users',
  auth: true,
  admin: {
    group: 'Admin',
    useAsTitle: 'email',
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      access: {
        create: isAdminField,
        update: isEditorField,
      },
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
        { label: 'Viewer', value: 'viewer' }
      ]
    }
  ],
}
