import type { FieldAccess } from "payload";
import { Access } from "payload";

export const isAdminField: FieldAccess = ({ req }) => 
    req.user?.role === 'admin'

export const isAdmin: Access = ({ req }) => 
    Boolean(req.user && req.user.role === 'admin')

export const isEditor: Access = ({ req }) => 
    Boolean(req.user && (req.user.role === 'admin' || req.user.role === 'editor'))

export const isEditorField: FieldAccess = ({ req }) => 
    Boolean(req.user && (req.user.role === 'admin' || req.user.role === 'editor'))