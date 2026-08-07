export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          registration_number: string | null
          address: string | null
          phone: string | null
          email: string | null
          logo_url: string | null
          primary_color: string | null
          currency: string | null
          timezone: string | null
          settings: Json | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['organizations']['Row']>
        Update: Partial<Database['public']['Tables']['organizations']['Row']>
      }
      roles: {
        Row: {
          id: string
          name: string
          description: string | null
          rank: number
          permissions: Json | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['roles']['Row']>
        Update: Partial<Database['public']['Tables']['roles']['Row']>
      }
      profiles: {
        Row: {
          id: string
          organization_id: string | null
          role_id: string | null
          first_name: string | null
          last_name: string | null
          phone: string | null
          register_number: string | null
          avatar_url: string | null
          language: string | null
          preferences: Json | null
          last_login_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['profiles']['Row']>
        Update: Partial<Database['public']['Tables']['profiles']['Row']>
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          profile_id: string
          role_id: string
          joined_at: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['organization_members']['Row']>
        Update: Partial<Database['public']['Tables']['organization_members']['Row']>
      }
      buildings: {
        Row: {
          id: string
          organization_id: string
          name: string
          block: string | null
          entrance: string | null
          floors: number | null
          apartment_count: number | null
          address: string | null
          description: string | null
          image_urls: Json | null
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['buildings']['Row']>
        Update: Partial<Database['public']['Tables']['buildings']['Row']>
      }
      apartments: {
        Row: {
          id: string
          organization_id: string
          building_id: string
          apartment_number: string
          floor: number | null
          area_sqm: number | null
          room_count: number | null
          status: string
          qr_code: string | null
          notes: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['apartments']['Row']>
        Update: Partial<Database['public']['Tables']['apartments']['Row']>
      }
      residents: {
        Row: {
          id: string
          organization_id: string
          profile_id: string | null
          apartment_id: string | null
          first_name: string
          last_name: string
          register_number: string | null
          phone: string | null
          email: string | null
          emergency_contact: Json | null
          avatar_url: string | null
          status: string
          move_in_date: string | null
          move_out_date: string | null
          notes: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['residents']['Row']>
        Update: Partial<Database['public']['Tables']['residents']['Row']>
      }
      family_members: {
        Row: {
          id: string
          resident_id: string
          full_name: string
          relationship: string | null
          age: number | null
          phone: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['family_members']['Row']>
        Update: Partial<Database['public']['Tables']['family_members']['Row']>
      }
      vehicles: {
        Row: {
          id: string
          organization_id: string
          resident_id: string | null
          plate_number: string
          brand: string | null
          model: string | null
          color: string | null
          is_visitor: boolean
          parking_slot_id: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['vehicles']['Row']>
        Update: Partial<Database['public']['Tables']['vehicles']['Row']>
      }
      parking_slots: {
        Row: {
          id: string
          organization_id: string
          building_id: string | null
          slot_number: string
          type: string
          is_occupied: boolean
          monthly_fee: number | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['parking_slots']['Row']>
        Update: Partial<Database['public']['Tables']['parking_slots']['Row']>
      }
      parking_logs: {
        Row: {
          id: string
          vehicle_id: string | null
          parking_slot_id: string | null
          plate_number: string | null
          entry_time: string
          exit_time: string | null
          created_by: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['parking_logs']['Row']>
        Update: Partial<Database['public']['Tables']['parking_logs']['Row']>
      }
      visitors: {
        Row: {
          id: string
          organization_id: string
          resident_id: string | null
          apartment_id: string | null
          visitor_name: string
          visitor_phone: string | null
          vehicle_plate: string | null
          purpose: string | null
          visit_date: string
          visit_time: string | null
          qr_code: string | null
          status: string
          check_in_at: string | null
          check_out_at: string | null
          checked_in_by: string | null
          checked_out_by: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['visitors']['Row']>
        Update: Partial<Database['public']['Tables']['visitors']['Row']>
      }
      visitor_blacklist: {
        Row: {
          id: string
          organization_id: string
          visitor_name: string
          visitor_phone: string | null
          reason: string | null
          created_by: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['visitor_blacklist']['Row']>
        Update: Partial<Database['public']['Tables']['visitor_blacklist']['Row']>
      }
      invoices: {
        Row: {
          id: string
          organization_id: string
          apartment_id: string | null
          resident_id: string | null
          invoice_number: string
          type: string
          title: string
          description: string | null
          amount: number
          tax: number
          discount: number
          total: number
          status: string
          due_date: string
          paid_at: string | null
          period_month: number | null
          period_year: number | null
          late_fee: number
          notes: string | null
          created_by: string | null
          updated_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['invoices']['Row']>
        Update: Partial<Database['public']['Tables']['invoices']['Row']>
      }
      payments: {
        Row: {
          id: string
          organization_id: string
          invoice_id: string
          resident_id: string | null
          amount: number
          method: string
          transaction_id: string | null
          qr_payload: Json | null
          status: string
          reference: string | null
          notes: string | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['payments']['Row']>
        Update: Partial<Database['public']['Tables']['payments']['Row']>
      }
      accounting_categories: {
        Row: {
          id: string
          organization_id: string
          name: string
          type: 'income' | 'expense'
          parent_id: string | null
          code: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['accounting_categories']['Row']>
        Update: Partial<Database['public']['Tables']['accounting_categories']['Row']>
      }
      accounting_transactions: {
        Row: {
          id: string
          organization_id: string
          category_id: string | null
          type: 'income' | 'expense'
          amount: number
          currency: string
          date: string
          reference: string | null
          description: string | null
          attachment_urls: Json | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['accounting_transactions']['Row']>
        Update: Partial<Database['public']['Tables']['accounting_transactions']['Row']>
      }
      complaints: {
        Row: {
          id: string
          organization_id: string
          resident_id: string
          apartment_id: string | null
          category: string
          title: string
          description: string
          status: string
          priority: string | null
          assigned_to: string | null
          image_urls: Json | null
          video_urls: Json | null
          resolved_at: string | null
          closed_at: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['complaints']['Row']>
        Update: Partial<Database['public']['Tables']['complaints']['Row']>
      }
      complaint_comments: {
        Row: {
          id: string
          complaint_id: string
          author_id: string
          body: string
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['complaint_comments']['Row']>
        Update: Partial<Database['public']['Tables']['complaint_comments']['Row']>
      }
      work_orders: {
        Row: {
          id: string
          organization_id: string
          building_id: string | null
          apartment_id: string | null
          assigned_to: string | null
          title: string
          description: string | null
          priority: string
          status: string
          before_photo_urls: Json | null
          after_photo_urls: Json | null
          scheduled_date: string | null
          completed_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['work_orders']['Row']>
        Update: Partial<Database['public']['Tables']['work_orders']['Row']>
      }
      work_order_comments: {
        Row: {
          id: string
          work_order_id: string
          author_id: string
          body: string
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['work_order_comments']['Row']>
        Update: Partial<Database['public']['Tables']['work_order_comments']['Row']>
      }
      announcements: {
        Row: {
          id: string
          organization_id: string
          type: string
          title: string
          body: string
          image_urls: Json | null
          attachment_urls: Json | null
          is_pinned: boolean
          scheduled_at: string | null
          published_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['announcements']['Row']>
        Update: Partial<Database['public']['Tables']['announcements']['Row']>
      }
      notifications: {
        Row: {
          id: string
          profile_id: string
          type: string
          title: string
          body: string | null
          data: Json | null
          read_at: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['notifications']['Row']>
        Update: Partial<Database['public']['Tables']['notifications']['Row']>
      }
      documents: {
        Row: {
          id: string
          organization_id: string
          folder: string | null
          name: string
          file_url: string
          mime_type: string | null
          size_bytes: number | null
          apartment_id: string | null
          building_id: string | null
          version: number
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['documents']['Row']>
        Update: Partial<Database['public']['Tables']['documents']['Row']>
      }
      meetings: {
        Row: {
          id: string
          organization_id: string
          title: string
          agenda: string | null
          minutes: string | null
          location: string | null
          scheduled_at: string
          duration_minutes: number | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['meetings']['Row']>
        Update: Partial<Database['public']['Tables']['meetings']['Row']>
      }
      meeting_attendees: {
        Row: {
          id: string
          meeting_id: string
          resident_id: string | null
          profile_id: string | null
          name: string
          status: 'invited' | 'confirmed' | 'attended' | 'absent'
          notes: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['meeting_attendees']['Row']>
        Update: Partial<Database['public']['Tables']['meeting_attendees']['Row']>
      }
      votes: {
        Row: {
          id: string
          organization_id: string
          meeting_id: string | null
          title: string
          description: string | null
          type: 'yes_no' | 'multiple_choice'
          options: Json
          is_anonymous: boolean
          starts_at: string
          ends_at: string
          created_by: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['votes']['Row']>
        Update: Partial<Database['public']['Tables']['votes']['Row']>
      }
      vote_responses: {
        Row: {
          id: string
          vote_id: string
          resident_id: string | null
          profile_id: string | null
          selected_option: string
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['vote_responses']['Row']>
        Update: Partial<Database['public']['Tables']['vote_responses']['Row']>
      }
      messages: {
        Row: {
          id: string
          organization_id: string
          conversation_id: string | null
          sender_id: string
          recipient_id: string | null
          body: string
          attachment_urls: Json | null
          read_at: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['messages']['Row']>
        Update: Partial<Database['public']['Tables']['messages']['Row']>
      }
      activity_logs: {
        Row: {
          id: string
          organization_id: string | null
          profile_id: string | null
          action: string
          entity_type: string | null
          entity_id: string | null
          old_value: Json | null
          new_value: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['activity_logs']['Row']>
        Update: Partial<Database['public']['Tables']['activity_logs']['Row']>
      }
    }
    Views: Record<string, never>
    Functions: {
      [key: string]: {
        Args: Record<string, unknown>
        Returns: unknown
      }
    }
    Enums: Record<string, never>
  }
}
