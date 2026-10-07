import type { Database } from '@/types/supabase'
import type { CustomFieldDefinition } from '@/types'

type CustomFieldRow = Database['public']['Tables']['custom_field_definitions']['Row']

export function normalizeCustomFieldDefinition(field: CustomFieldRow): CustomFieldDefinition {
  return {
    ...field,
    options: Array.isArray(field.options)
      ? field.options.filter((option): option is string => typeof option === 'string')
      : [],
    required: field.required ?? false,
    sort_order: field.sort_order ?? 0,
    active: field.active ?? true,
  }
}
