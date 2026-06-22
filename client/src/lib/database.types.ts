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
      albums: {
        Row: {
          cover_large_key: string | null
          cover_thumb_key: string | null
          created_at: string
          id: string
          is_public: boolean
          name: string
          owner_id: string
          pack_config: Json
          pack_large_key: string | null
          pack_thumb_key: string | null
          published_at: string | null
          qr_secret: string | null
          share_code: string
          status: Database["public"]["Enums"]["album_status"]
          total_stickers: number
          trade_config: Json
        }
        Insert: {
          cover_large_key?: string | null
          cover_thumb_key?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          name: string
          owner_id: string
          pack_config?: Json
          pack_large_key?: string | null
          pack_thumb_key?: string | null
          published_at?: string | null
          qr_secret?: string | null
          share_code: string
          status?: Database["public"]["Enums"]["album_status"]
          total_stickers: number
          trade_config?: Json
        }
        Update: {
          cover_large_key?: string | null
          cover_thumb_key?: string | null
          created_at?: string
          id?: string
          is_public?: boolean
          name?: string
          owner_id?: string
          pack_config?: Json
          pack_large_key?: string | null
          pack_thumb_key?: string | null
          published_at?: string | null
          qr_secret?: string | null
          share_code?: string
          status?: Database["public"]["Enums"]["album_status"]
          total_stickers?: number
          trade_config?: Json
        }
        Relationships: [
          {
            foreignKeyName: "albums_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      packs: {
        Row: {
          album_id: string
          contents: Json | null
          granted_at: string
          id: string
          opened_at: string | null
          source: Database["public"]["Enums"]["pack_source"]
          user_id: string
        }
        Insert: {
          album_id: string
          contents?: Json | null
          granted_at?: string
          id?: string
          opened_at?: string | null
          source: Database["public"]["Enums"]["pack_source"]
          user_id: string
        }
        Update: {
          album_id?: string
          contents?: Json | null
          granted_at?: string
          id?: string
          opened_at?: string | null
          source?: Database["public"]["Enums"]["pack_source"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "packs_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          is_admin: boolean
          push_token: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          is_admin?: boolean
          push_token?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_admin?: boolean
          push_token?: string | null
        }
        Relationships: []
      }
      stickers: {
        Row: {
          album_id: string
          created_at: string
          id: string
          large_key: string
          name: string
          number: number
          rarity: Database["public"]["Enums"]["sticker_rarity"]
          thumb_key: string
          traits: Json
        }
        Insert: {
          album_id: string
          created_at?: string
          id?: string
          large_key: string
          name: string
          number: number
          rarity?: Database["public"]["Enums"]["sticker_rarity"]
          thumb_key: string
          traits?: Json
        }
        Update: {
          album_id?: string
          created_at?: string
          id?: string
          large_key?: string
          name?: string
          number?: number
          rarity?: Database["public"]["Enums"]["sticker_rarity"]
          thumb_key?: string
          traits?: Json
        }
        Relationships: [
          {
            foreignKeyName: "stickers_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          entitlement_id: string
          expires_at: string
          original_transaction_id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          provider: string
          status: Database["public"]["Enums"]["subscription_status"]
          store: Database["public"]["Enums"]["subscription_store"]
          updated_at: string
          user_id: string
        }
        Insert: {
          entitlement_id: string
          expires_at: string
          original_transaction_id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          provider?: string
          status: Database["public"]["Enums"]["subscription_status"]
          store: Database["public"]["Enums"]["subscription_store"]
          updated_at?: string
          user_id: string
        }
        Update: {
          entitlement_id?: string
          expires_at?: string
          original_transaction_id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          provider?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          store?: Database["public"]["Enums"]["subscription_store"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trade_offers: {
        Row: {
          album_id: string
          created_at: string
          expires_at: string
          from_user: string
          id: string
          offered_sticker_id: string
          requested_sticker_id: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["trade_status"]
          to_user: string
        }
        Insert: {
          album_id: string
          created_at?: string
          expires_at?: string
          from_user: string
          id?: string
          offered_sticker_id: string
          requested_sticker_id: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["trade_status"]
          to_user: string
        }
        Update: {
          album_id?: string
          created_at?: string
          expires_at?: string
          from_user?: string
          id?: string
          offered_sticker_id?: string
          requested_sticker_id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["trade_status"]
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "trade_offers_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_offers_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_offers_offered_sticker_id_fkey"
            columns: ["offered_sticker_id"]
            isOneToOne: false
            referencedRelation: "stickers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_offers_offered_sticker_id_fkey"
            columns: ["offered_sticker_id"]
            isOneToOne: false
            referencedRelation: "v_user_album_inventory"
            referencedColumns: ["sticker_id"]
          },
          {
            foreignKeyName: "trade_offers_requested_sticker_id_fkey"
            columns: ["requested_sticker_id"]
            isOneToOne: false
            referencedRelation: "stickers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trade_offers_requested_sticker_id_fkey"
            columns: ["requested_sticker_id"]
            isOneToOne: false
            referencedRelation: "v_user_album_inventory"
            referencedColumns: ["sticker_id"]
          },
          {
            foreignKeyName: "trade_offers_to_user_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_album_membership: {
        Row: {
          album_id: string
          joined_at: string
          last_daily_claim_at: string | null
          last_qr_redeem_at: string | null
          user_id: string
          welcome_granted: boolean
        }
        Insert: {
          album_id: string
          joined_at?: string
          last_daily_claim_at?: string | null
          last_qr_redeem_at?: string | null
          user_id: string
          welcome_granted?: boolean
        }
        Update: {
          album_id?: string
          joined_at?: string
          last_daily_claim_at?: string | null
          last_qr_redeem_at?: string | null
          user_id?: string
          welcome_granted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_album_membership_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_album_membership_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_collection: {
        Row: {
          first_obtained_at: string
          last_obtained_at: string
          pasted: boolean
          quantity: number
          sticker_id: string
          user_id: string
        }
        Insert: {
          first_obtained_at?: string
          last_obtained_at?: string
          pasted?: boolean
          quantity: number
          sticker_id: string
          user_id: string
        }
        Update: {
          first_obtained_at?: string
          last_obtained_at?: string
          pasted?: boolean
          quantity?: number
          sticker_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_collection_sticker_id_fkey"
            columns: ["sticker_id"]
            isOneToOne: false
            referencedRelation: "stickers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_collection_sticker_id_fkey"
            columns: ["sticker_id"]
            isOneToOne: false
            referencedRelation: "v_user_album_inventory"
            referencedColumns: ["sticker_id"]
          },
          {
            foreignKeyName: "user_collection_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_user_album_inventory: {
        Row: {
          album_id: string | null
          missing: boolean | null
          pasted: boolean | null
          quantity: number | null
          rarity: Database["public"]["Enums"]["sticker_rarity"] | null
          sticker_id: string | null
          sticker_number: number | null
          tradable_stock: number | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_album_membership_album_id_fkey"
            columns: ["album_id"]
            isOneToOne: false
            referencedRelation: "albums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_album_membership_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      fn_add_sticker: {
        Args: {
          p_album_id: string
          p_large_key: string
          p_name: string
          p_number: number
          p_rarity: Database["public"]["Enums"]["sticker_rarity"]
          p_thumb_key: string
          p_traits?: Json
        }
        Returns: string
      }
      fn_admin_list_published_albums: {
        Args: never
        Returns: {
          id: string
          is_public: boolean
          member_count: number
          name: string
          owner_id: string
          owner_name: string
          published_at: string
          total_stickers: number
        }[]
      }
      fn_album_matches: {
        Args: { p_album_id: string; p_limit?: number }
        Returns: {
          i_give_sticker_id: string
          i_give_sticker_name: string
          i_give_sticker_number: number
          i_give_sticker_rarity: Database["public"]["Enums"]["sticker_rarity"]
          i_give_sticker_thumb_key: string
          other_user_avatar_url: string
          other_user_id: string
          other_user_name: string
          they_give_sticker_id: string
          they_give_sticker_name: string
          they_give_sticker_number: number
          they_give_sticker_rarity: Database["public"]["Enums"]["sticker_rarity"]
          they_give_sticker_thumb_key: string
        }[]
      }
      fn_album_progress: {
        Args: { p_album_ids: string[] }
        Returns: {
          album_id: string
          my_pasted_count: number
          stickers_loaded: number
          total_stickers: number
        }[]
      }
      fn_apply_pack_open: {
        Args: { p_pack_id: string; p_sticker_ids: string[] }
        Returns: Json
      }
      fn_apply_qr_redeem: {
        Args: { p_album_id: string; p_issued_at: string; p_nonce: string }
        Returns: Json
      }
      fn_archive_album: { Args: { p_album_id: string }; Returns: undefined }
      fn_assert_owner: {
        Args: { p_album_id: string }
        Returns: {
          cover_large_key: string | null
          cover_thumb_key: string | null
          created_at: string
          id: string
          is_public: boolean
          name: string
          owner_id: string
          pack_config: Json
          pack_large_key: string | null
          pack_thumb_key: string | null
          published_at: string | null
          qr_secret: string | null
          share_code: string
          status: Database["public"]["Enums"]["album_status"]
          total_stickers: number
          trade_config: Json
        }
        SetofOptions: {
          from: "*"
          to: "albums"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_claim_daily_pack: { Args: { p_album_id: string }; Returns: Json }
      fn_count_active_albums: { Args: { p_owner: string }; Returns: number }
      fn_create_album: {
        Args: {
          p_cover_large_key?: string
          p_cover_thumb_key?: string
          p_name: string
          p_pack_large_key?: string
          p_pack_thumb_key?: string
          p_total_stickers: number
        }
        Returns: string
      }
      fn_create_trade_offer: {
        Args: {
          p_album_id: string
          p_offered_sticker_id: string
          p_requested_sticker_id: string
          p_to_user: string
        }
        Returns: Json
      }
      fn_delete_sticker: { Args: { p_sticker_id: string }; Returns: undefined }
      fn_enforce_expired_subscriptions: { Args: never; Returns: number }
      fn_enforce_subscription_gates: {
        Args: { p_owner_id: string }
        Returns: undefined
      }
      fn_gen_share_code: { Args: never; Returns: string }
      fn_grant_packs: {
        Args: {
          p_album: string
          p_count: number
          p_source: Database["public"]["Enums"]["pack_source"]
          p_user: string
        }
        Returns: string[]
      }
      fn_is_pro: { Args: { p_user: string }; Returns: boolean }
      fn_join_album: { Args: { p_share_code: string }; Returns: Json }
      fn_my_daily_status: {
        Args: { p_album_ids: string[] }
        Returns: {
          album_id: string
          cooldown_hours: number
          count: number
          enabled: boolean
          next_available_at: string
        }[]
      }
      fn_paste_sticker: { Args: { p_sticker_id: string }; Returns: undefined }
      fn_publish_album: { Args: { p_album_id: string }; Returns: undefined }
      fn_resolve_trade_offer: {
        Args: { p_action: string; p_offer_id: string }
        Returns: Json
      }
      fn_rotate_qr_secret: { Args: { p_album_id: string }; Returns: undefined }
      fn_set_album_public: {
        Args: { p_album_id: string; p_is_public: boolean }
        Returns: undefined
      }
      fn_subscription_upsert: {
        Args: {
          p_entitlement_id: string
          p_expires_at: string
          p_original_transaction_id: string
          p_plan: Database["public"]["Enums"]["subscription_plan"]
          p_status: Database["public"]["Enums"]["subscription_status"]
          p_store: Database["public"]["Enums"]["subscription_store"]
          p_user_id: string
        }
        Returns: undefined
      }
      fn_trade_limit_reached: {
        Args: { p_album_id: string; p_trade_config: Json; p_user: string }
        Returns: boolean
      }
      fn_update_album_content: {
        Args: {
          p_album_id: string
          p_cover_large_key?: string
          p_cover_thumb_key?: string
          p_name?: string
          p_pack_large_key?: string
          p_pack_thumb_key?: string
          p_total_stickers?: number
        }
        Returns: undefined
      }
      fn_update_album_economy: {
        Args: {
          p_album_id: string
          p_pack_config?: Json
          p_trade_config?: Json
        }
        Returns: undefined
      }
      fn_update_sticker: {
        Args: {
          p_large_key?: string
          p_name?: string
          p_rarity?: Database["public"]["Enums"]["sticker_rarity"]
          p_sticker_id: string
          p_thumb_key?: string
          p_traits?: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      album_status: "draft" | "published" | "read_only" | "archived"
      pack_source: "welcome" | "daily" | "qr" | "admin"
      sticker_rarity: "common" | "rare" | "epic" | "legendary"
      subscription_plan: "monthly" | "annual"
      subscription_status: "active" | "in_grace" | "expired" | "cancelled"
      subscription_store: "app_store" | "play_store"
      trade_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "cancelled"
        | "expired"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      album_status: ["draft", "published", "read_only", "archived"],
      pack_source: ["welcome", "daily", "qr", "admin"],
      sticker_rarity: ["common", "rare", "epic", "legendary"],
      subscription_plan: ["monthly", "annual"],
      subscription_status: ["active", "in_grace", "expired", "cancelled"],
      subscription_store: ["app_store", "play_store"],
      trade_status: ["pending", "accepted", "rejected", "cancelled", "expired"],
    },
  },
} as const
