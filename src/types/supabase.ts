export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ai_usage_logs: {
        Row: {
          completion_tokens: number
          cost_usd: number | null
          created_at: string
          duration_ms: number | null
          feature: string
          id: string
          model: string
          prompt_tokens: number
          tenant_id: string
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          completion_tokens?: number
          cost_usd?: number | null
          created_at?: string
          duration_ms?: number | null
          feature: string
          id?: string
          model?: string
          prompt_tokens?: number
          tenant_id: string
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          completion_tokens?: number
          cost_usd?: number | null
          created_at?: string
          duration_ms?: number | null
          feature?: string
          id?: string
          model?: string
          prompt_tokens?: number
          tenant_id?: string
          total_tokens?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          client_id: string
          created_at: string
          end_at: string
          google_event_id: string | null
          id: string
          notes: string | null
          service_id: string | null
          staff_id: string
          start_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          end_at: string
          google_event_id?: string | null
          id?: string
          notes?: string | null
          service_id?: string | null
          staff_id: string
          start_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          end_at?: string
          google_event_id?: string | null
          id?: string
          notes?: string | null
          service_id?: string | null
          staff_id?: string
          start_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          active: boolean
          assigned_staff_id: string | null
          birth_date: string | null
          created_at: string
          custom_fields: Json | null
          email: string | null
          full_name: string
          gender: string | null
          id: string
          last_appointment_at: string | null
          notes: string | null
          phone: string | null
          preferred_language: Database["public"]["Enums"]["preferred_language"]
          profile_id: string | null
          tags: string[] | null
          tenant_id: string
          updated_at: string
          whatsapp_reminders_consent: boolean
        }
        Insert: {
          active?: boolean
          assigned_staff_id?: string | null
          birth_date?: string | null
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          last_appointment_at?: string | null
          notes?: string | null
          phone?: string | null
          preferred_language?: Database["public"]["Enums"]["preferred_language"]
          profile_id?: string | null
          tags?: string[] | null
          tenant_id: string
          updated_at?: string
          whatsapp_reminders_consent?: boolean
        }
        Update: {
          active?: boolean
          assigned_staff_id?: string | null
          birth_date?: string | null
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          last_appointment_at?: string | null
          notes?: string | null
          phone?: string | null
          preferred_language?: Database["public"]["Enums"]["preferred_language"]
          profile_id?: string | null
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string
          whatsapp_reminders_consent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "clients_assigned_staff_id_fkey"
            columns: ["assigned_staff_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          active: boolean | null
          created_at: string
          entity_type: string
          field_key: string
          field_type: Database["public"]["Enums"]["custom_field_type"]
          id: string
          label_en: string
          label_it: string
          options: Json | null
          required: boolean | null
          sort_order: number | null
          tenant_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string
          entity_type?: string
          field_key: string
          field_type: Database["public"]["Enums"]["custom_field_type"]
          id?: string
          label_en: string
          label_it: string
          options?: Json | null
          required?: boolean | null
          sort_order?: number | null
          tenant_id: string
        }
        Update: {
          active?: boolean | null
          created_at?: string
          entity_type?: string
          field_key?: string
          field_type?: Database["public"]["Enums"]["custom_field_type"]
          id?: string
          label_en?: string
          label_it?: string
          options?: Json | null
          required?: boolean | null
          sort_order?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          appointment_id: string | null
          client_id: string
          created_at: string
          id: string
          mime_type: string | null
          name: string
          size_bytes: number | null
          storage_path: string
          tenant_id: string
          type: Database["public"]["Enums"]["document_type"]
          uploaded_by: string
          visible_to_client: boolean
        }
        Insert: {
          appointment_id?: string | null
          client_id: string
          created_at?: string
          id?: string
          mime_type?: string | null
          name: string
          size_bytes?: number | null
          storage_path: string
          tenant_id: string
          type?: Database["public"]["Enums"]["document_type"]
          uploaded_by: string
          visible_to_client?: boolean
        }
        Update: {
          appointment_id?: string | null
          client_id?: string
          created_at?: string
          id?: string
          mime_type?: string | null
          name?: string
          size_bytes?: number | null
          storage_path?: string
          tenant_id?: string
          type?: Database["public"]["Enums"]["document_type"]
          uploaded_by?: string
          visible_to_client?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "documents_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          appointment_id: string | null
          client_id: string | null
          created_at: string
          error_message: string | null
          id: string
          locale: Database["public"]["Enums"]["preferred_language"]
          resend_id: string | null
          sent_at: string | null
          status: string
          subject: string
          template: string
          tenant_id: string
          to_email: string
        }
        Insert: {
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          locale?: Database["public"]["Enums"]["preferred_language"]
          resend_id?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          template: string
          tenant_id: string
          to_email: string
        }
        Update: {
          appointment_id?: string | null
          client_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          locale?: Database["public"]["Enums"]["preferred_language"]
          resend_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          template?: string
          tenant_id?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rules: {
        Row: {
          active: boolean
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          delay_minutes: number | null
          event_trigger: string
          id: string
          template_key: string
          tenant_id: string
        }
        Insert: {
          active?: boolean
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          delay_minutes?: number | null
          event_trigger: string
          id?: string
          template_key: string
          tenant_id: string
        }
        Update: {
          active?: boolean
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          delay_minutes?: number | null
          event_trigger?: string
          id?: string
          template_key?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_steps: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          step_billing: boolean | null
          step_company: boolean | null
          step_profession: boolean | null
          step_services: boolean | null
          tenant_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          step_billing?: boolean | null
          step_company?: boolean | null
          step_profession?: boolean | null
          step_services?: boolean | null
          tenant_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          step_billing?: boolean | null
          step_company?: boolean | null
          step_profession?: boolean | null
          step_services?: boolean | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_steps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          preferred_language: Database["public"]["Enums"]["preferred_language"]
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          preferred_language?: Database["public"]["Enums"]["preferred_language"]
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          preferred_language?: Database["public"]["Enums"]["preferred_language"]
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_entries: {
        Row: {
          body_fat_pct: number | null
          client_id: string
          created_at: string
          height_cm: number | null
          id: string
          measurements: Json | null
          muscle_mass_kg: number | null
          notes: string | null
          recorded_at: string
          recorded_by: string | null
          tenant_id: string
          weight_kg: number | null
        }
        Insert: {
          body_fat_pct?: number | null
          client_id: string
          created_at?: string
          height_cm?: number | null
          id?: string
          measurements?: Json | null
          muscle_mass_kg?: number | null
          notes?: string | null
          recorded_at?: string
          recorded_by?: string | null
          tenant_id: string
          weight_kg?: number | null
        }
        Update: {
          body_fat_pct?: number | null
          client_id?: string
          created_at?: string
          height_cm?: number | null
          id?: string
          measurements?: Json | null
          muscle_mass_kg?: number | null
          notes?: string | null
          recorded_at?: string
          recorded_by?: string | null
          tenant_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_entries_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_entries_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          currency: string
          description: string | null
          duration_min: number
          id: string
          name: string
          price: number | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          duration_min?: number
          id?: string
          name: string
          price?: number | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          duration_min?: number
          id?: string
          name?: string
          price?: number | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_events: {
        Row: {
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          processed: boolean
          processed_at: string | null
          stripe_event_id: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          processed?: boolean
          processed_at?: string | null
          stripe_event_id: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processed?: boolean
          processed_at?: string | null
          stripe_event_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          brand_accent: string | null
          brand_primary: string | null
          created_at: string
          id: string
          locale: Database["public"]["Enums"]["preferred_language"]
          logo_url: string | null
          max_clients: number
          name: string
          plan: Database["public"]["Enums"]["tenant_plan"]
          profession: Database["public"]["Enums"]["profession_type"]
          slug: string
          status: Database["public"]["Enums"]["tenant_status"]
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          timezone: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          brand_accent?: string | null
          brand_primary?: string | null
          created_at?: string
          id?: string
          locale?: Database["public"]["Enums"]["preferred_language"]
          logo_url?: string | null
          max_clients?: number
          name: string
          plan?: Database["public"]["Enums"]["tenant_plan"]
          profession?: Database["public"]["Enums"]["profession_type"]
          slug: string
          status?: Database["public"]["Enums"]["tenant_status"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          brand_accent?: string | null
          brand_primary?: string | null
          created_at?: string
          id?: string
          locale?: Database["public"]["Enums"]["preferred_language"]
          logo_url?: string | null
          max_clients?: number
          name?: string
          plan?: Database["public"]["Enums"]["tenant_plan"]
          profession?: Database["public"]["Enums"]["profession_type"]
          slug?: string
          status?: Database["public"]["Enums"]["tenant_status"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_connections: {
        Row: {
          access_token_encrypted: string
          connected_at: string
          display_phone_number: string | null
          id: string
          last_error: string | null
          phone_number_id: string
          status: string
          tenant_id: string
          token_expires_at: string | null
          updated_at: string
          verified_name: string | null
          whatsapp_business_account_id: string
        }
        Insert: {
          access_token_encrypted: string
          connected_at?: string
          display_phone_number?: string | null
          id?: string
          last_error?: string | null
          phone_number_id: string
          status?: string
          tenant_id: string
          token_expires_at?: string | null
          updated_at?: string
          verified_name?: string | null
          whatsapp_business_account_id: string
        }
        Update: {
          access_token_encrypted?: string
          connected_at?: string
          display_phone_number?: string | null
          id?: string
          last_error?: string | null
          phone_number_id?: string
          status?: string
          tenant_id?: string
          token_expires_at?: string | null
          updated_at?: string
          verified_name?: string | null
          whatsapp_business_account_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          appointment_id: string | null
          body: string
          client_id: string | null
          created_at: string
          delivered_at: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          error_message: string | null
          id: string
          read_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["message_status"]
          tenant_id: string
          trigger_event: string | null
          wa_message_id: string | null
        }
        Insert: {
          appointment_id?: string | null
          body: string
          client_id?: string | null
          created_at?: string
          delivered_at?: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          error_message?: string | null
          id?: string
          read_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          tenant_id: string
          trigger_event?: string | null
          wa_message_id?: string | null
        }
        Update: {
          appointment_id?: string | null
          body?: string
          client_id?: string | null
          created_at?: string
          delivered_at?: string | null
          direction?: Database["public"]["Enums"]["message_direction"]
          error_message?: string | null
          id?: string
          read_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          tenant_id?: string
          trigger_event?: string | null
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_tenant_id: { Args: never; Returns: string }
      auth_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      custom_jwt_claims: { Args: { event: Json }; Returns: Json }
      is_staff_or_above: { Args: never; Returns: boolean }
      is_super_admin: { Args: never; Returns: boolean }
      is_tenant_admin: { Args: never; Returns: boolean }
      seed_default_custom_fields: {
        Args: {
          p_profession: Database["public"]["Enums"]["profession_type"]
          p_tenant_id: string
        }
        Returns: undefined
      }
      seed_default_services: {
        Args: {
          p_profession: Database["public"]["Enums"]["profession_type"]
          p_tenant_id: string
        }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "completed"
        | "cancelled"
        | "no_show"
      custom_field_type:
        | "text"
        | "number"
        | "date"
        | "select"
        | "multi_select"
        | "checkbox"
        | "textarea"
      document_type:
        | "nutrition_plan"
        | "workout_plan"
        | "report"
        | "medical"
        | "image"
        | "other"
      message_direction: "inbound" | "outbound"
      message_status: "pending" | "sent" | "delivered" | "read" | "failed"
      notification_channel: "whatsapp" | "email" | "both"
      preferred_language: "it" | "en"
      profession_type:
        | "nutritionist"
        | "personal_trainer"
        | "physiotherapist"
        | "osteopath"
        | "massage_therapist"
        | "other"
      tenant_plan: "trial" | "starter" | "professional" | "business"
      tenant_status: "active" | "inactive" | "suspended" | "cancelled"
      user_role: "SUPER_ADMIN" | "TENANT_ADMIN" | "STAFF" | "CLIENT"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null
          avif_autodetection: boolean | null
          created_at: string | null
          file_size_limit: number | null
          id: string
          lifecycle_configuration: Json | null
          lifecycle_configuration_generation: string | null
          name: string
          owner: string | null
          owner_id: string | null
          public: boolean | null
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string | null
          versioning_status: string
        }
        Insert: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id: string
          lifecycle_configuration?: Json | null
          lifecycle_configuration_generation?: string | null
          name: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
          versioning_status?: string
        }
        Update: {
          allowed_mime_types?: string[] | null
          avif_autodetection?: boolean | null
          created_at?: string | null
          file_size_limit?: number | null
          id?: string
          lifecycle_configuration?: Json | null
          lifecycle_configuration_generation?: string | null
          name?: string
          owner?: string | null
          owner_id?: string | null
          public?: boolean | null
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string | null
          versioning_status?: string
        }
        Relationships: []
      }
      buckets_analytics: {
        Row: {
          created_at: string
          deleted_at: string | null
          format: string
          id: string
          name: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          format?: string
          id?: string
          name?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      buckets_vectors: {
        Row: {
          created_at: string
          id: string
          type: Database["storage"]["Enums"]["buckettype"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          type?: Database["storage"]["Enums"]["buckettype"]
          updated_at?: string
        }
        Relationships: []
      }
      migrations: {
        Row: {
          executed_at: string | null
          hash: string
          id: number
          name: string
        }
        Insert: {
          executed_at?: string | null
          hash: string
          id: number
          name: string
        }
        Update: {
          executed_at?: string | null
          hash?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      objects: {
        Row: {
          archived_at: string | null
          bucket_id: string | null
          created_at: string | null
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          last_accessed_at: string | null
          metadata: Json | null
          name: string | null
          owner: string | null
          owner_id: string | null
          path_tokens: string[] | null
          updated_at: string | null
          user_metadata: Json | null
          version: string | null
        }
        Insert: {
          archived_at?: string | null
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          is_delete_marker?: boolean
          is_versioned?: boolean
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Update: {
          archived_at?: string | null
          bucket_id?: string | null
          created_at?: string | null
          id?: string
          is_delete_marker?: boolean
          is_versioned?: boolean
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string | null
          owner?: string | null
          owner_id?: string | null
          path_tokens?: string[] | null
          updated_at?: string | null
          user_metadata?: Json | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "objects_bucketId_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          in_progress_size: number
          key: string
          metadata: Json | null
          owner_id: string | null
          upload_signature: string
          user_metadata: Json | null
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id: string
          in_progress_size?: number
          key: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature: string
          user_metadata?: Json | null
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          in_progress_size?: number
          key?: string
          metadata?: Json | null
          owner_id?: string | null
          upload_signature?: string
          user_metadata?: Json | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
        ]
      }
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string
          created_at: string
          etag: string
          id: string
          key: string
          owner_id: string | null
          part_number: number
          size: number
          upload_id: string
          version: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          etag: string
          id?: string
          key: string
          owner_id?: string | null
          part_number: number
          size?: number
          upload_id: string
          version: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          etag?: string
          id?: string
          key?: string
          owner_id?: string | null
          part_number?: number
          size?: number
          upload_id?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
            columns: ["upload_id"]
            isOneToOne: false
            referencedRelation: "s3_multipart_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      vector_indexes: {
        Row: {
          bucket_id: string
          created_at: string
          data_type: string
          dimension: number
          distance_metric: string
          id: string
          metadata_configuration: Json | null
          name: string
          updated_at: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          data_type: string
          dimension: number
          distance_metric: string
          id?: string
          metadata_configuration?: Json | null
          name: string
          updated_at?: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          data_type?: string
          dimension?: number
          distance_metric?: string
          id?: string
          metadata_configuration?: Json | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vector_indexes_bucket_id_fkey"
            columns: ["bucket_id"]
            isOneToOne: false
            referencedRelation: "buckets_vectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      allow_any_operation: {
        Args: { expected_operations: string[] }
        Returns: boolean
      }
      allow_only_operation: {
        Args: { expected_operation: string }
        Returns: boolean
      }
      can_insert_object: {
        Args: { bucketid: string; metadata: Json; name: string; owner: string }
        Returns: undefined
      }
      extension: { Args: { name: string }; Returns: string }
      filename: { Args: { name: string }; Returns: string }
      foldername: { Args: { name: string }; Returns: string[] }
      get_common_prefix: {
        Args: { p_delimiter: string; p_key: string; p_prefix: string }
        Returns: string
      }
      get_size_by_bucket: {
        Args: { delete_markers?: string; noncurrent_versions?: string }
        Returns: {
          bucket_id: string
          size: number
        }[]
      }
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string
          delimiter_param: string
          max_keys?: number
          next_key_token?: string
          next_upload_token?: string
          prefix_param: string
          raw_prefix_param?: string
        }
        Returns: {
          created_at: string
          id: string
          key: string
        }[]
      }
      list_objects_with_delimiter: {
        Args: {
          _bucket_id: string
          delete_markers?: string
          delimiter_param: string
          max_keys?: number
          next_token?: string
          next_token_archived_at?: string
          next_token_version?: string
          noncurrent_versions?: string
          prefix_param: string
          sort_order?: string
          start_after?: string
        }
        Returns: {
          archived_at: string
          created_at: string
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
          version: string
        }[]
      }
      operation: { Args: never; Returns: string }
      search: {
        Args: {
          bucketname: string
          delete_markers?: string
          levels?: number
          limits?: number
          noncurrent_versions?: string
          offsets?: number
          prefix: string
          search?: string
          sortcolumn?: string
          sortorder?: string
        }
        Returns: {
          archived_at: string
          created_at: string
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
          version: string
        }[]
      }
      search_by_timestamp: {
        Args: {
          delete_markers?: string
          noncurrent_versions?: string
          p_bucket_id: string
          p_level: number
          p_limit: number
          p_prefix: string
          p_sort_column: string
          p_sort_column_after: string
          p_sort_order: string
          p_start_after: string
          p_start_after_version?: string
        }
        Returns: {
          archived_at: string
          created_at: string
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
          version: string
        }[]
      }
      search_v2: {
        Args: {
          bucket_name: string
          delete_markers?: string
          levels?: number
          limits?: number
          noncurrent_versions?: string
          prefix: string
          sort_column?: string
          sort_column_after?: string
          sort_order?: string
          start_after?: string
          start_after_archived_at?: string
          start_after_is_continuation?: boolean
          start_after_version?: string
        }
        Returns: {
          archived_at: string
          created_at: string
          id: string
          is_delete_marker: boolean
          is_versioned: boolean
          key: string
          last_accessed_at: string
          metadata: Json
          name: string
          updated_at: string
          version: string
        }[]
      }
    }
    Enums: {
      buckettype: "STANDARD" | "ANALYTICS" | "VECTOR"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      appointment_status: [
        "scheduled",
        "confirmed",
        "completed",
        "cancelled",
        "no_show",
      ],
      custom_field_type: [
        "text",
        "number",
        "date",
        "select",
        "multi_select",
        "checkbox",
        "textarea",
      ],
      document_type: [
        "nutrition_plan",
        "workout_plan",
        "report",
        "medical",
        "image",
        "other",
      ],
      message_direction: ["inbound", "outbound"],
      message_status: ["pending", "sent", "delivered", "read", "failed"],
      notification_channel: ["whatsapp", "email", "both"],
      preferred_language: ["it", "en"],
      profession_type: [
        "nutritionist",
        "personal_trainer",
        "physiotherapist",
        "osteopath",
        "massage_therapist",
        "other",
      ],
      tenant_plan: ["trial", "starter", "professional", "business"],
      tenant_status: ["active", "inactive", "suspended", "cancelled"],
      user_role: ["SUPER_ADMIN", "TENANT_ADMIN", "STAFF", "CLIENT"],
    },
  },
  storage: {
    Enums: {
      buckettype: ["STANDARD", "ANALYTICS", "VECTOR"],
    },
  },
} as const
