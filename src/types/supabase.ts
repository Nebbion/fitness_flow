// Questo file viene generato automaticamente dal comando:
// npm run db:generate
//
// Non modificare manualmente.
// Esegui: npx supabase gen types typescript --local > src/types/supabase.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          brand_primary: string
          brand_accent: string
          profession: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          stripe_price_id: string | null
          plan: string
          trial_ends_at: string | null
          status: string
          max_clients: number
          timezone: string
          locale: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tenants']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['tenants']['Insert']>
      }
      profiles: {
        Row: {
          id: string
          tenant_id: string | null
          role: string
          full_name: string | null
          avatar_url: string | null
          phone: string | null
          preferred_language: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      clients: {
        Row: {
          id: string
          tenant_id: string
          profile_id: string | null
          assigned_staff_id: string | null
          full_name: string
          email: string | null
          phone: string | null
          birth_date: string | null
          gender: string | null
          notes: string | null
          tags: string[]
          custom_fields: Json
          preferred_language: string
          active: boolean
          last_appointment_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['clients']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['clients']['Insert']>
      }
      services: {
        Row: {
          id: string
          tenant_id: string
          name: string
          description: string | null
          duration_min: number
          price: number | null
          currency: string
          color: string
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['services']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['services']['Insert']>
      }
      appointments: {
        Row: {
          id: string
          tenant_id: string
          client_id: string
          staff_id: string
          service_id: string | null
          start_at: string
          end_at: string
          status: string
          notes: string | null
          google_event_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['appointments']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['appointments']['Insert']>
      }
      documents: {
        Row: {
          id: string
          tenant_id: string
          client_id: string
          uploaded_by: string
          appointment_id: string | null
          type: string
          name: string
          storage_path: string
          size_bytes: number | null
          mime_type: string | null
          visible_to_client: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['documents']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['documents']['Insert']>
      }
      progress_entries: {
        Row: {
          id: string
          tenant_id: string
          client_id: string
          recorded_by: string | null
          recorded_at: string
          weight_kg: number | null
          height_cm: number | null
          body_fat_pct: number | null
          muscle_mass_kg: number | null
          measurements: Json
          notes: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['progress_entries']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['progress_entries']['Insert']>
      }
      custom_field_definitions: {
        Row: {
          id: string
          tenant_id: string
          entity_type: string
          field_key: string
          label_it: string
          label_en: string
          field_type: string
          options: Json
          required: boolean
          sort_order: number
          active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['custom_field_definitions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['custom_field_definitions']['Insert']>
      }
      whatsapp_messages: {
        Row: {
          id: string
          tenant_id: string
          client_id: string | null
          direction: string
          body: string
          wa_message_id: string | null
          status: string
          trigger_event: string | null
          appointment_id: string | null
          error_message: string | null
          sent_at: string | null
          delivered_at: string | null
          read_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['whatsapp_messages']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['whatsapp_messages']['Insert']>
      }
      email_logs: {
        Row: {
          id: string
          tenant_id: string
          client_id: string | null
          template: string
          resend_id: string | null
          to_email: string
          subject: string
          status: string
          locale: string
          appointment_id: string | null
          error_message: string | null
          sent_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['email_logs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['email_logs']['Insert']>
      }
      ai_usage_logs: {
        Row: {
          id: string
          tenant_id: string
          user_id: string
          feature: string
          model: string
          prompt_tokens: number
          completion_tokens: number
          total_tokens: number
          cost_usd: number | null
          duration_ms: number | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['ai_usage_logs']['Row'], 'id' | 'created_at' | 'total_tokens'>
        Update: Partial<Database['public']['Tables']['ai_usage_logs']['Insert']>
      }
      notification_rules: {
        Row: {
          id: string
          tenant_id: string
          event_trigger: string
          channel: string
          delay_minutes: number
          template_key: string
          active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['notification_rules']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['notification_rules']['Insert']>
      }
      subscription_events: {
        Row: {
          id: string
          tenant_id: string | null
          stripe_event_id: string
          event_type: string
          payload: Json
          processed: boolean
          processed_at: string | null
          error_message: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['subscription_events']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['subscription_events']['Insert']>
      }
      onboarding_steps: {
        Row: {
          id: string
          tenant_id: string
          step_company: boolean
          step_profession: boolean
          step_services: boolean
          step_billing: boolean
          completed_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['onboarding_steps']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['onboarding_steps']['Insert']>
      }
    }
    Views: {}
    Functions: {
      auth_tenant_id: { Args: {}; Returns: string }
      auth_user_role: { Args: {}; Returns: string }
      is_super_admin: { Args: {}; Returns: boolean }
      is_tenant_admin: { Args: {}; Returns: boolean }
      is_staff_or_above: { Args: {}; Returns: boolean }
      seed_default_services: {
        Args: { p_tenant_id: string; p_profession: string }
        Returns: void
      }
      seed_default_custom_fields: {
        Args: { p_tenant_id: string; p_profession: string }
        Returns: void
      }
    }
    Enums: {
      user_role: 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'STAFF' | 'CLIENT'
      tenant_plan: 'trial' | 'starter' | 'professional' | 'business'
      tenant_status: 'active' | 'inactive' | 'suspended' | 'cancelled'
      appointment_status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'
      document_type: 'nutrition_plan' | 'workout_plan' | 'report' | 'medical' | 'image' | 'other'
      profession_type: 'nutritionist' | 'personal_trainer' | 'physiotherapist' | 'osteopath' | 'massage_therapist' | 'other'
      custom_field_type: 'text' | 'number' | 'date' | 'select' | 'multi_select' | 'checkbox' | 'textarea'
      preferred_language: 'it' | 'en'
      notification_channel: 'whatsapp' | 'email' | 'both'
      message_direction: 'inbound' | 'outbound'
      message_status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
    }
  }
}
