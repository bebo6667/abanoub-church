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
  public: {
    Tables: {
      announcement_reactions: {
        Row: {
          announcement_id: string
          created_at: string
          emoji: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          created_at?: string
          emoji: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          created_at?: string
          emoji?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reactions_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_views: {
        Row: {
          announcement_id: string
          created_at: string
          id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          announcement_id: string
          created_at?: string
          id?: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          announcement_id?: string
          created_at?: string
          id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_views_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_votes: {
        Row: {
          announcement_id: string
          created_at: string
          id: string
          option_index: number
          updated_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          created_at?: string
          id?: string
          option_index: number
          updated_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          created_at?: string
          id?: string
          option_index?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_votes_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          attachments: Json
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          is_published: boolean
          link_url: string | null
          poll: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          attachments?: Json
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          link_url?: string | null
          poll?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          attachments?: Json
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_published?: boolean
          link_url?: string | null
          poll?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      attendance_checkins: {
        Row: {
          checked_at: string
          checked_by: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          note: string | null
          present: boolean
          schedule_id: string
          self_reported: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          checked_at?: string
          checked_by: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          present?: boolean
          schedule_id: string
          self_reported?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          checked_at?: string
          checked_by?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          present?: boolean
          schedule_id?: string
          self_reported?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_checkins_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_responses: {
        Row: {
          assignment_id: string
          created_at: string
          id: string
          note: string | null
          reason: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          assignment_id: string
          created_at?: string
          id?: string
          note?: string | null
          reason?: string | null
          status: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          assignment_id?: string
          created_at?: string
          id?: string
          note?: string | null
          reason?: string | null
          status?: Database["public"]["Enums"]["attendance_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_responses_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "schedule_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read: boolean
          title: string
          type: string
          url: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title: string
          type: string
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          type?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          age: number | null
          church_name: string | null
          created_at: string
          date_of_birth: string | null
          education_stage: Database["public"]["Enums"]["education_stage"] | null
          email: string | null
          full_name: string
          home_latitude: number | null
          home_longitude: number | null
          id: string
          last_confession_date: string | null
          linked_servant_id: string | null
          phone: string | null
          profile_image_url: string | null
          rank: Database["public"]["Enums"]["deacon_rank"] | null
          rejection_reason: string | null
          requested_role: Database["public"]["Enums"]["requested_role"]
          spiritual_father: string | null
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          age?: number | null
          church_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          education_stage?:
            | Database["public"]["Enums"]["education_stage"]
            | null
          email?: string | null
          full_name?: string
          home_latitude?: number | null
          home_longitude?: number | null
          id: string
          last_confession_date?: string | null
          linked_servant_id?: string | null
          phone?: string | null
          profile_image_url?: string | null
          rank?: Database["public"]["Enums"]["deacon_rank"] | null
          rejection_reason?: string | null
          requested_role?: Database["public"]["Enums"]["requested_role"]
          spiritual_father?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          age?: number | null
          church_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          education_stage?:
            | Database["public"]["Enums"]["education_stage"]
            | null
          email?: string | null
          full_name?: string
          home_latitude?: number | null
          home_longitude?: number | null
          id?: string
          last_confession_date?: string | null
          linked_servant_id?: string | null
          phone?: string | null
          profile_image_url?: string | null
          rank?: Database["public"]["Enums"]["deacon_rank"] | null
          rejection_reason?: string | null
          requested_role?: Database["public"]["Enums"]["requested_role"]
          spiritual_father?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_linked_servant_id_fkey"
            columns: ["linked_servant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      schedule_assignments: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          schedule_id: string
          service_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          schedule_id: string
          service_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          schedule_id?: string
          service_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          created_at: string
          created_by: string | null
          friday_date: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["schedule_status"]
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          friday_date: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["schedule_status"]
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          friday_date?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["schedule_status"]
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      visitations: {
        Row: {
          by_user_id: string
          created_at: string
          deacon_id: string
          id: string
          note: string
          updated_at: string
          visited_at: string
        }
        Insert: {
          by_user_id: string
          created_at?: string
          deacon_id: string
          id?: string
          note: string
          updated_at?: string
          visited_at?: string
        }
        Update: {
          by_user_id?: string
          created_at?: string
          deacon_id?: string
          id?: string
          note?: string
          updated_at?: string
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitations_by_user_id_fkey"
            columns: ["by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitations_deacon_id_fkey"
            columns: ["deacon_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved: { Args: { _uid: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "deacon" | "servant"
      attendance_status: "attend" | "decline"
      deacon_rank:
        | "psaltos"
        | "agnostos"
        | "ibodiakon"
        | "diakon"
        | "archdiakon"
      education_stage:
        | "primary"
        | "preparatory"
        | "secondary"
        | "university"
        | "graduate"
      profile_status: "pending" | "approved" | "rejected"
      requested_role: "admin" | "deacon" | "servant" | "pending"
      schedule_status: "draft" | "published"
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
  public: {
    Enums: {
      app_role: ["admin", "deacon", "servant"],
      attendance_status: ["attend", "decline"],
      deacon_rank: ["psaltos", "agnostos", "ibodiakon", "diakon", "archdiakon"],
      education_stage: [
        "primary",
        "preparatory",
        "secondary",
        "university",
        "graduate",
      ],
      profile_status: ["pending", "approved", "rejected"],
      requested_role: ["admin", "deacon", "servant", "pending"],
      schedule_status: ["draft", "published"],
    },
  },
} as const
