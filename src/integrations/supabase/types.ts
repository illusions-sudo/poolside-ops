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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      customer_notes: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          note: string
          organization_id: string
          property_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          note: string
          organization_id: string
          property_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          note?: string
          organization_id?: string
          property_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          active: boolean
          alternate_phone: string | null
          billing_address: string | null
          billing_city: string | null
          billing_state: string | null
          billing_zip: string | null
          company_name: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          is_demo: boolean
          last_name: string | null
          notes: string | null
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          alternate_phone?: string | null
          billing_address?: string | null
          billing_city?: string | null
          billing_state?: string | null
          billing_zip?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_demo?: boolean
          last_name?: string | null
          notes?: string | null
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          alternate_phone?: string | null
          billing_address?: string | null
          billing_city?: string | null
          billing_state?: string | null
          billing_zip?: string | null
          company_name?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          is_demo?: boolean
          last_name?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_audit_log: {
        Row: {
          action: string
          changed_by: string | null
          changes: Json
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          organization_id: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          changes?: Json
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          organization_id: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          changes?: Json
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          id: string
          invoice_id: string
          position: number
          quantity: number
          service_plan_id: string | null
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          position?: number
          quantity?: number
          service_plan_id?: string | null
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          position?: number
          quantity?: number
          service_plan_id?: string | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_service_plan_id_fkey"
            columns: ["service_plan_id"]
            isOneToOne: false
            referencedRelation: "service_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_due: number
          amount_paid: number
          created_at: string
          customer_id: string
          discount: number
          due_date: string
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          organization_id: string
          property_id: string | null
          status: string
          subtotal: number
          tax: number
          tax_rate: number
          total: number
          updated_at: string
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          customer_id: string
          discount?: number
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          organization_id: string
          property_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          customer_id?: string
          discount?: number
          due_date?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          organization_id?: string
          property_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          tax_rate?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          business_name: string | null
          city: string | null
          created_at: string
          default_invoice_notes: string | null
          default_payment_terms: number
          default_tax_rate: number
          email: string | null
          id: string
          invoice_prefix: string
          logo_url: string | null
          name: string
          next_invoice_number: number
          phone: string | null
          state: string | null
          updated_at: string
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          business_name?: string | null
          city?: string | null
          created_at?: string
          default_invoice_notes?: string | null
          default_payment_terms?: number
          default_tax_rate?: number
          email?: string | null
          id?: string
          invoice_prefix?: string
          logo_url?: string | null
          name: string
          next_invoice_number?: number
          phone?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string | null
          city?: string | null
          created_at?: string
          default_invoice_notes?: string | null
          default_payment_terms?: number
          default_tax_rate?: number
          email?: string | null
          id?: string
          invoice_prefix?: string
          logo_url?: string | null
          name?: string
          next_invoice_number?: number
          phone?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          allow_overpayment: boolean
          amount: number
          created_at: string
          customer_id: string
          id: string
          invoice_id: string | null
          notes: string | null
          organization_id: string
          payment_date: string
          payment_method: string
          status: string
          transaction_reference: string | null
        }
        Insert: {
          allow_overpayment?: boolean
          amount: number
          created_at?: string
          customer_id: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          organization_id: string
          payment_date?: string
          payment_method?: string
          status?: string
          transaction_reference?: string | null
        }
        Update: {
          allow_overpayment?: boolean
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          invoice_id?: string | null
          notes?: string | null
          organization_id?: string
          payment_date?: string
          payment_method?: string
          status?: string
          transaction_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      pools: {
        Row: {
          active: boolean
          approximate_volume: number | null
          created_at: string
          equipment_notes: string | null
          id: string
          organization_id: string
          pool_name: string | null
          pool_type: string | null
          property_id: string
          special_instructions: string | null
          surface_type: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          approximate_volume?: number | null
          created_at?: string
          equipment_notes?: string | null
          id?: string
          organization_id: string
          pool_name?: string | null
          pool_type?: string | null
          property_id: string
          special_instructions?: string | null
          surface_type?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          approximate_volume?: number | null
          created_at?: string
          equipment_notes?: string | null
          id?: string
          organization_id?: string
          pool_name?: string | null
          pool_type?: string | null
          property_id?: string
          special_instructions?: string | null
          surface_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pools_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pools_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          organization_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          organization_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          organization_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          access_notes: string | null
          active: boolean
          address: string
          city: string | null
          created_at: string
          customer_id: string
          gate_code: string | null
          id: string
          organization_id: string
          property_name: string | null
          property_notes: string | null
          state: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          access_notes?: string | null
          active?: boolean
          address: string
          city?: string | null
          created_at?: string
          customer_id: string
          gate_code?: string | null
          id?: string
          organization_id: string
          property_name?: string | null
          property_notes?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          access_notes?: string | null
          active?: boolean
          address?: string
          city?: string | null
          created_at?: string
          customer_id?: string
          gate_code?: string | null
          id?: string
          organization_id?: string
          property_name?: string | null
          property_notes?: string | null
          state?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      route_days: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          route_date: string
          technician_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          route_date: string
          technician_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          route_date?: string
          technician_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_days_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_days_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      route_stops: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          position: number
          route_day_id: string
          service_record_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          position?: number
          route_day_id: string
          service_record_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          position?: number
          route_day_id?: string
          service_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_route_day_id_fkey"
            columns: ["route_day_id"]
            isOneToOne: false
            referencedRelation: "route_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_service_record_id_fkey"
            columns: ["service_record_id"]
            isOneToOne: true
            referencedRelation: "service_records"
            referencedColumns: ["id"]
          },
        ]
      }
      service_audit_log: {
        Row: {
          action: string
          changed_by: string | null
          changes: Json
          created_at: string
          id: string
          organization_id: string
          service_record_id: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          changes?: Json
          created_at?: string
          id?: string
          organization_id: string
          service_record_id: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          changes?: Json
          created_at?: string
          id?: string
          organization_id?: string
          service_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_audit_log_service_record_id_fkey"
            columns: ["service_record_id"]
            isOneToOne: false
            referencedRelation: "service_records"
            referencedColumns: ["id"]
          },
        ]
      }
      service_checklist_items: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          label: string
          organization_id: string
          position: number
          service_record_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          label: string
          organization_id: string
          position?: number
          service_record_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          label?: string
          organization_id?: string
          position?: number
          service_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_checklist_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_checklist_items_service_record_id_fkey"
            columns: ["service_record_id"]
            isOneToOne: false
            referencedRelation: "service_records"
            referencedColumns: ["id"]
          },
        ]
      }
      service_chemical_usage: {
        Row: {
          chemical_name: string
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          pool_id: string | null
          quantity: number
          recorded_by: string | null
          service_record_id: string
          unit: string
        }
        Insert: {
          chemical_name: string
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          pool_id?: string | null
          quantity?: number
          recorded_by?: string | null
          service_record_id: string
          unit?: string
        }
        Update: {
          chemical_name?: string
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          pool_id?: string | null
          quantity?: number
          recorded_by?: string | null
          service_record_id?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_chemical_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_chemical_usage_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_chemical_usage_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_chemical_usage_service_record_id_fkey"
            columns: ["service_record_id"]
            isOneToOne: false
            referencedRelation: "service_records"
            referencedColumns: ["id"]
          },
        ]
      }
      service_chemistry_readings: {
        Row: {
          alkalinity: number | null
          calcium_hardness: number | null
          created_at: string
          cyanuric_acid: number | null
          free_chlorine: number | null
          id: string
          notes: string | null
          organization_id: string
          ph: number | null
          pool_id: string | null
          reading_date: string
          recorded_by: string | null
          salt: number | null
          service_record_id: string
          total_chlorine: number | null
          updated_at: string
          water_temperature: number | null
        }
        Insert: {
          alkalinity?: number | null
          calcium_hardness?: number | null
          created_at?: string
          cyanuric_acid?: number | null
          free_chlorine?: number | null
          id?: string
          notes?: string | null
          organization_id: string
          ph?: number | null
          pool_id?: string | null
          reading_date?: string
          recorded_by?: string | null
          salt?: number | null
          service_record_id: string
          total_chlorine?: number | null
          updated_at?: string
          water_temperature?: number | null
        }
        Update: {
          alkalinity?: number | null
          calcium_hardness?: number | null
          created_at?: string
          cyanuric_acid?: number | null
          free_chlorine?: number | null
          id?: string
          notes?: string | null
          organization_id?: string
          ph?: number | null
          pool_id?: string | null
          reading_date?: string
          recorded_by?: string | null
          salt?: number | null
          service_record_id?: string
          total_chlorine?: number | null
          updated_at?: string
          water_temperature?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_chemistry_readings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_chemistry_readings_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_chemistry_readings_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_chemistry_readings_service_record_id_fkey"
            columns: ["service_record_id"]
            isOneToOne: false
            referencedRelation: "service_records"
            referencedColumns: ["id"]
          },
        ]
      }
      service_equipment_observations: {
        Row: {
          condition: string
          created_at: string
          equipment_type: string
          id: string
          notes: string | null
          organization_id: string
          pool_id: string | null
          recorded_by: string | null
          service_record_id: string
        }
        Insert: {
          condition?: string
          created_at?: string
          equipment_type: string
          id?: string
          notes?: string | null
          organization_id: string
          pool_id?: string | null
          recorded_by?: string | null
          service_record_id: string
        }
        Update: {
          condition?: string
          created_at?: string
          equipment_type?: string
          id?: string
          notes?: string | null
          organization_id?: string
          pool_id?: string | null
          recorded_by?: string | null
          service_record_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_equipment_observations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_equipment_observations_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_equipment_observations_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_equipment_observations_service_record_id_fkey"
            columns: ["service_record_id"]
            isOneToOne: false
            referencedRelation: "service_records"
            referencedColumns: ["id"]
          },
        ]
      }
      service_photos: {
        Row: {
          caption: string | null
          created_at: string
          customer_id: string | null
          id: string
          organization_id: string
          pool_id: string | null
          property_id: string | null
          service_record_id: string
          storage_path: string
          technician_id: string | null
        }
        Insert: {
          caption?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          organization_id: string
          pool_id?: string | null
          property_id?: string | null
          service_record_id: string
          storage_path: string
          technician_id?: string | null
        }
        Update: {
          caption?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          organization_id?: string
          pool_id?: string | null
          property_id?: string | null
          service_record_id?: string
          storage_path?: string
          technician_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_photos_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_photos_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_photos_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_photos_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_photos_service_record_id_fkey"
            columns: ["service_record_id"]
            isOneToOne: false
            referencedRelation: "service_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_photos_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_plans: {
        Row: {
          active: boolean
          billing_frequency: string
          created_at: string
          custom_interval_days: number | null
          customer_id: string
          description: string | null
          estimated_duration_minutes: number
          frequency: string
          id: string
          next_service_date: string | null
          organization_id: string
          pool_id: string | null
          preferred_day: number | null
          preferred_window_end: string | null
          preferred_window_start: string | null
          price: number
          property_id: string
          service_name: string
          status: string
          technician_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          billing_frequency?: string
          created_at?: string
          custom_interval_days?: number | null
          customer_id: string
          description?: string | null
          estimated_duration_minutes?: number
          frequency?: string
          id?: string
          next_service_date?: string | null
          organization_id: string
          pool_id?: string | null
          preferred_day?: number | null
          preferred_window_end?: string | null
          preferred_window_start?: string | null
          price?: number
          property_id: string
          service_name: string
          status?: string
          technician_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          billing_frequency?: string
          created_at?: string
          custom_interval_days?: number | null
          customer_id?: string
          description?: string | null
          estimated_duration_minutes?: number
          frequency?: string
          id?: string
          next_service_date?: string | null
          organization_id?: string
          pool_id?: string | null
          preferred_day?: number | null
          preferred_window_end?: string | null
          preferred_window_start?: string | null
          price?: number
          property_id?: string
          service_name?: string
          status?: string
          technician_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_plans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_plans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_plans_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_plans_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_plans_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_records: {
        Row: {
          actual_duration_minutes: number | null
          cancel_reason: string | null
          completed_at: string | null
          created_at: string
          customer_id: string
          customer_visible_notes: string | null
          estimated_duration_minutes: number
          id: string
          notes: string | null
          organization_id: string
          pool_id: string | null
          property_id: string
          scheduled_time: string | null
          service_date: string
          service_plan_id: string | null
          skip_note: string | null
          skip_reason: string | null
          started_at: string | null
          status: string
          technician_id: string | null
          updated_at: string
        }
        Insert: {
          actual_duration_minutes?: number | null
          cancel_reason?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id: string
          customer_visible_notes?: string | null
          estimated_duration_minutes?: number
          id?: string
          notes?: string | null
          organization_id: string
          pool_id?: string | null
          property_id: string
          scheduled_time?: string | null
          service_date?: string
          service_plan_id?: string | null
          skip_note?: string | null
          skip_reason?: string | null
          started_at?: string | null
          status?: string
          technician_id?: string | null
          updated_at?: string
        }
        Update: {
          actual_duration_minutes?: number | null
          cancel_reason?: string | null
          completed_at?: string | null
          created_at?: string
          customer_id?: string
          customer_visible_notes?: string | null
          estimated_duration_minutes?: number
          id?: string
          notes?: string | null
          organization_id?: string
          pool_id?: string | null
          property_id?: string
          scheduled_time?: string | null
          service_date?: string
          service_plan_id?: string | null
          skip_note?: string | null
          skip_reason?: string | null
          started_at?: string | null
          status?: string
          technician_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_records_pool_id_fkey"
            columns: ["pool_id"]
            isOneToOne: false
            referencedRelation: "pools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_records_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_records_service_plan_id_fkey"
            columns: ["service_plan_id"]
            isOneToOne: false
            referencedRelation: "service_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_records_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_service: { Args: { _service_id: string }; Returns: boolean }
      create_organization: {
        Args: {
          p_first_name?: string
          p_last_name?: string
          p_name: string
          p_phone?: string
        }
        Returns: string
      }
      current_org_id: { Args: never; Returns: string }
      generate_service_records: { Args: { p_weeks?: number }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_admin: { Args: never; Returns: boolean }
      reset_demo_data: { Args: never; Returns: undefined }
      save_route_order: {
        Args: { p_route_day_id: string; p_service_ids: string[] }
        Returns: undefined
      }
      seed_demo_data: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "owner" | "admin" | "employee"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "employee"],
    },
  },
} as const
