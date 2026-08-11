/**
 * Database types for XLResale — GENERATED, do not hand-edit.
 *
 * Regenerate after any migration:
 *   npx supabase@2.109.1 gen types typescript --project-id nkykpkzesfpetjcnowri > lib/database.types.ts
 *
 * `geography(point,4326)` columns (sales.location, profiles.home_point) are
 * opaque to PostgREST and come back as strings. Read coordinates through the
 * `sales_near` RPC, which projects real lat/lng numbers.
 */

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
      categories: {
        Row: {
          color: string
          id: number
          label: string
          slug: string
        }
        Insert: {
          color: string
          id?: number
          label: string
          slug: string
        }
        Update: {
          color?: string
          id?: number
          label?: string
          slug?: string
        }
        Relationships: []
      }
      finds: {
        Row: {
          created_at: string
          est_value: number | null
          finder_id: string
          found_on: string
          id: string
          is_public: boolean
          note: string | null
          photo_path: string | null
          price_paid: number | null
          sale_id: string | null
          title: string
        }
        Insert: {
          created_at?: string
          est_value?: number | null
          finder_id: string
          found_on?: string
          id?: string
          is_public?: boolean
          note?: string | null
          photo_path?: string | null
          price_paid?: number | null
          sale_id?: string | null
          title: string
        }
        Update: {
          created_at?: string
          est_value?: number | null
          finder_id?: string
          found_on?: string
          id?: string
          is_public?: boolean
          note?: string | null
          photo_path?: string | null
          price_paid?: number | null
          sale_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "finds_finder_id_fkey"
            columns: ["finder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finds_finder_id_fkey"
            columns: ["finder_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finds_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          created_at: string
          email_enabled: boolean
          profile_id: string
          push_enabled: boolean
          radius_miles: number
          sms_consent_at: string | null
          sms_consent_text: string | null
          sms_enabled: boolean
          sms_phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          profile_id: string
          push_enabled?: boolean
          radius_miles?: number
          sms_consent_at?: string | null
          sms_consent_text?: string | null
          sms_enabled?: boolean
          sms_phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          profile_id?: string
          push_enabled?: boolean
          radius_miles?: number
          sms_consent_at?: string | null
          sms_consent_text?: string | null
          sms_enabled?: boolean
          sms_phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_prefs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          home_address: string | null
          home_point: unknown
          id: string
          is_public: boolean
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          home_address?: string | null
          home_point?: unknown
          id: string
          is_public?: boolean
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          home_address?: string | null
          home_point?: unknown
          id?: string
          is_public?: boolean
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      sale_categories: {
        Row: {
          category_id: number
          sale_id: string
        }
        Insert: {
          category_id: number
          sale_id: string
        }
        Update: {
          category_id?: number
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_categories_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          exclude_from_bulk: boolean
          id: string
          is_sold: boolean
          item_discount_percent: number
          name: string
          photo_key: string | null
          position: number
          price: number
          sale_id: string
          sold_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          exclude_from_bulk?: boolean
          id?: string
          is_sold?: boolean
          item_discount_percent?: number
          name: string
          photo_key?: string | null
          position?: number
          price: number
          sale_id: string
          sold_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          exclude_from_bulk?: boolean
          id?: string
          is_sold?: boolean
          item_discount_percent?: number
          name?: string
          photo_key?: string | null
          position?: number
          price?: number
          sale_id?: string
          sold_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_photos: {
        Row: {
          created_at: string
          id: string
          position: number
          sale_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          sale_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          sale_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_photos_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_watchers: {
        Row: {
          created_at: string
          sale_id: string
          shopper_id: string
        }
        Insert: {
          created_at?: string
          sale_id: string
          shopper_id: string
        }
        Update: {
          created_at?: string
          sale_id?: string
          shopper_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_watchers_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_watchers_shopper_id_fkey"
            columns: ["shopper_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_watchers_shopper_id_fkey"
            columns: ["shopper_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          address: string
          closes_at: string
          created_at: string
          description: string | null
          discount_active: boolean
          discount_percent: number
          free_pile: boolean
          free_pile_note: string | null
          host_id: string
          id: string
          listing_paid: boolean
          location: unknown
          opens_at: string
          raw_description: string | null
          sale_date: string
          search_tsv: unknown
          status: Database["public"]["Enums"]["sale_status"]
          stripe_payment_id: string | null
          time_zone: string
          title: string
          updated_at: string
          went_live_at: string | null
        }
        Insert: {
          address: string
          closes_at: string
          created_at?: string
          description?: string | null
          discount_active?: boolean
          discount_percent?: number
          free_pile?: boolean
          free_pile_note?: string | null
          host_id: string
          id?: string
          listing_paid?: boolean
          location: unknown
          opens_at: string
          raw_description?: string | null
          sale_date: string
          search_tsv?: unknown
          status?: Database["public"]["Enums"]["sale_status"]
          stripe_payment_id?: string | null
          time_zone?: string
          title: string
          updated_at?: string
          went_live_at?: string | null
        }
        Update: {
          address?: string
          closes_at?: string
          created_at?: string
          description?: string | null
          discount_active?: boolean
          discount_percent?: number
          free_pile?: boolean
          free_pile_note?: string | null
          host_id?: string
          id?: string
          listing_paid?: boolean
          location?: unknown
          opens_at?: string
          raw_description?: string | null
          sale_date?: string
          search_tsv?: unknown
          status?: Database["public"]["Enums"]["sale_status"]
          stripe_payment_id?: string | null
          time_zone?: string
          title?: string
          updated_at?: string
          went_live_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_routes: {
        Row: {
          created_at: string
          id: string
          name: string
          route_date: string
          shopper_id: string
          stop_ids: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string
          route_date: string
          shopper_id: string
          stop_ids?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          route_date?: string
          shopper_id?: string
          stop_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_routes_shopper_id_fkey"
            columns: ["shopper_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_routes_shopper_id_fkey"
            columns: ["shopper_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlist_alerts: {
        Row: {
          created_at: string
          id: string
          matched_term: string | null
          notified_at: string | null
          sale_id: string
          seen_at: string | null
          shopper_id: string
          wishlist_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          matched_term?: string | null
          notified_at?: string | null
          sale_id: string
          seen_at?: string | null
          shopper_id: string
          wishlist_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          matched_term?: string | null
          notified_at?: string | null
          sale_id?: string
          seen_at?: string | null
          shopper_id?: string
          wishlist_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_alerts_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_alerts_shopper_id_fkey"
            columns: ["shopper_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_alerts_shopper_id_fkey"
            columns: ["shopper_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_alerts_wishlist_id_fkey"
            columns: ["wishlist_id"]
            isOneToOne: false
            referencedRelation: "wishlists"
            referencedColumns: ["id"]
          },
        ]
      }
      wishlists: {
        Row: {
          active: boolean
          category_id: number | null
          created_at: string
          id: string
          max_miles: number
          shopper_id: string
          term: string
        }
        Insert: {
          active?: boolean
          category_id?: number | null
          created_at?: string
          id?: string
          max_miles?: number
          shopper_id: string
          term: string
        }
        Update: {
          active?: boolean
          category_id?: number | null
          created_at?: string
          id?: string
          max_miles?: number
          shopper_id?: string
          term?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_shopper_id_fkey"
            columns: ["shopper_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_shopper_id_fkey"
            columns: ["shopper_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      sale_items_priced: {
        Row: {
          created_at: string | null
          discount_active: boolean | null
          effective_price: number | null
          exclude_from_bulk: boolean | null
          id: string | null
          is_sold: boolean | null
          item_discount_percent: number | null
          name: string | null
          photo_key: string | null
          position: number | null
          price: number | null
          sale_discount_percent: number | null
          sale_id: string | null
          sold_at: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      close_expired_sales: { Args: never; Returns: undefined }
      item_effective_price: {
        Args: {
          base_price: number
          excluded: boolean
          item_discount: number
          sale_active: boolean
          sale_discount: number
        }
        Returns: number
      }
      match_sale_to_wishlists: { Args: { in_sale_id: string }; Returns: number }
      sales_near: {
        Args: {
          in_lat: number
          in_lng: number
          in_miles?: number
          on_date?: string
        }
        Returns: {
          address: string
          categories: string[]
          closes_at: string
          description: string
          distance_miles: number
          host_id: string
          id: string
          lat: number
          lng: number
          opens_at: string
          sale_date: string
          status: Database["public"]["Enums"]["sale_status"]
          time_zone: string
          title: string
        }[]
      }
    }
    Enums: {
      sale_status: "scheduled" | "live" | "winding_down" | "closed"
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
      sale_status: ["scheduled", "live", "winding_down", "closed"],
    },
  },
} as const

/** A row as returned by the `sales_near` map query. */
export type NearbySale = Database["public"]["Functions"]["sales_near"]["Returns"][number];
export type SaleStatus = Database["public"]["Enums"]["sale_status"];
export type Sale = Database["public"]["Tables"]["sales"]["Row"];
export type SaleItem = Database["public"]["Tables"]["sale_items"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type PublicProfile = Database["public"]["Views"]["public_profiles"]["Row"];
export type Wishlist = Database["public"]["Tables"]["wishlists"]["Row"];
export type Find = Database["public"]["Tables"]["finds"]["Row"];
