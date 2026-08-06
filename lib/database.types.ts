/**
 * Database types for XLResale.
 *
 * Hand-authored to match `schema.sql` exactly so `strict` TypeScript is
 * meaningful from day one. Once the Supabase project exists, regenerate this
 * file to keep it authoritative:
 *
 *   npx supabase gen types typescript --project-id <ref> > lib/database.types.ts
 *
 * `geography(point, 4326)` columns are opaque to PostgREST, so `location` and
 * `home_point` come back as strings (WKB hex). Read coordinates through the
 * `sales_near` RPC, which projects real `lat` / `lng` numbers.
 */

export type SaleStatus = "scheduled" | "live" | "winding_down" | "closed";

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          home_point: string | null;
          home_address: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          home_point?: string | null;
          home_address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          home_point?: string | null;
          home_address?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: { id: number; slug: string; label: string; color: string };
        Insert: { id?: number; slug: string; label: string; color: string };
        Update: { id?: number; slug?: string; label?: string; color?: string };
        Relationships: [];
      };
      sales: {
        Row: {
          id: string;
          host_id: string;
          title: string;
          description: string | null;
          raw_description: string | null;
          address: string;
          location: string;
          sale_date: string;
          opens_at: string;
          closes_at: string;
          time_zone: string;
          status: SaleStatus;
          went_live_at: string | null;
          listing_paid: boolean;
          stripe_payment_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          host_id: string;
          title: string;
          description?: string | null;
          raw_description?: string | null;
          address: string;
          location: string;
          sale_date: string;
          opens_at: string;
          closes_at: string;
          time_zone?: string;
          status?: SaleStatus;
          went_live_at?: string | null;
          listing_paid?: boolean;
          stripe_payment_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          host_id?: string;
          title?: string;
          description?: string | null;
          raw_description?: string | null;
          address?: string;
          location?: string;
          sale_date?: string;
          opens_at?: string;
          closes_at?: string;
          time_zone?: string;
          status?: SaleStatus;
          went_live_at?: string | null;
          listing_paid?: boolean;
          stripe_payment_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sale_categories: {
        Row: { sale_id: string; category_id: number };
        Insert: { sale_id: string; category_id: number };
        Update: { sale_id?: string; category_id?: number };
        Relationships: [];
      };
      sale_photos: {
        Row: {
          id: string;
          sale_id: string;
          storage_path: string;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          sale_id: string;
          storage_path: string;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          sale_id?: string;
          storage_path?: string;
          position?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      saved_routes: {
        Row: {
          id: string;
          shopper_id: string;
          name: string;
          route_date: string;
          stop_ids: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shopper_id: string;
          name?: string;
          route_date: string;
          stop_ids?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shopper_id?: string;
          name?: string;
          route_date?: string;
          stop_ids?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sale_watchers: {
        Row: { sale_id: string; shopper_id: string; created_at: string };
        Insert: { sale_id: string; shopper_id: string; created_at?: string };
        Update: { sale_id?: string; shopper_id?: string; created_at?: string };
        Relationships: [];
      };
      notification_prefs: {
        Row: {
          profile_id: string;
          email_enabled: boolean;
          push_enabled: boolean;
          sms_enabled: boolean;
          sms_phone: string | null;
          sms_consent_at: string | null;
          sms_consent_text: string | null;
          radius_miles: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          profile_id: string;
          email_enabled?: boolean;
          push_enabled?: boolean;
          sms_enabled?: boolean;
          sms_phone?: string | null;
          sms_consent_at?: string | null;
          sms_consent_text?: string | null;
          radius_miles?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          profile_id?: string;
          email_enabled?: boolean;
          push_enabled?: boolean;
          sms_enabled?: boolean;
          sms_phone?: string | null;
          sms_consent_at?: string | null;
          sms_consent_text?: string | null;
          radius_miles?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      sales_near: {
        Args: {
          in_lat: number;
          in_lng: number;
          in_miles?: number;
          on_date?: string;
        };
        Returns: {
          id: string;
          host_id: string;
          title: string;
          description: string | null;
          address: string;
          lat: number;
          lng: number;
          sale_date: string;
          opens_at: string;
          closes_at: string;
          time_zone: string;
          status: SaleStatus;
          distance_miles: number;
          categories: string[];
        }[];
      };
    };
    Enums: {
      sale_status: SaleStatus;
    };
    CompositeTypes: Record<never, never>;
  };
}

/** A row as returned by the `sales_near` map query. */
export type NearbySale = Database["public"]["Functions"]["sales_near"]["Returns"][number];
export type Sale = Database["public"]["Tables"]["sales"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
