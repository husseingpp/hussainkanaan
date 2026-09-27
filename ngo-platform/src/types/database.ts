export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      hero_slides: {
        Row: {
          created_at: string;
          cta_label: NonNullable<Json>;
          cta_link: string | null;
          id: string;
          image_url: string;
          is_active: boolean;
          overlay_opacity: number;
          sort_order: number;
          subtitle: NonNullable<Json>;
          text_position: string;
          title: NonNullable<Json>;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          cta_label?: NonNullable<Json>;
          cta_link?: string | null;
          id?: string;
          image_url: string;
          is_active?: boolean;
          overlay_opacity?: number;
          sort_order?: number;
          subtitle?: NonNullable<Json>;
          text_position?: string;
          title?: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          cta_label?: NonNullable<Json>;
          cta_link?: string | null;
          id?: string;
          image_url?: string;
          is_active?: boolean;
          overlay_opacity?: number;
          sort_order?: number;
          subtitle?: NonNullable<Json>;
          text_position?: string;
          title?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [];
      };
      locales: {
        Row: {
          code: string;
          created_at: string;
          dir: Database["public"]["Enums"]["text_dir"];
          is_default: boolean;
          is_enabled: boolean;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          dir?: Database["public"]["Enums"]["text_dir"];
          is_default?: boolean;
          is_enabled?: boolean;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          dir?: Database["public"]["Enums"]["text_dir"];
          is_default?: boolean;
          is_enabled?: boolean;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      media: {
        Row: {
          alt: NonNullable<Json>;
          created_at: string;
          height: number | null;
          id: string;
          size_bytes: number | null;
          storage_path: string;
          updated_at: string;
          uploaded_by: string | null;
          url: string;
          width: number | null;
        };
        Insert: {
          alt?: NonNullable<Json>;
          created_at?: string;
          height?: number | null;
          id?: string;
          size_bytes?: number | null;
          storage_path: string;
          updated_at?: string;
          uploaded_by?: string | null;
          url: string;
          width?: number | null;
        };
        Update: {
          alt?: NonNullable<Json>;
          created_at?: string;
          height?: number | null;
          id?: string;
          size_bytes?: number | null;
          storage_path?: string;
          updated_at?: string;
          uploaded_by?: string | null;
          url?: string;
          width?: number | null;
        };
        Relationships: [];
      };
      nav_items: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          label: NonNullable<Json>;
          link_type: Database["public"]["Enums"]["nav_link_type"];
          parent_id: string | null;
          sort_order: number;
          target: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          label?: NonNullable<Json>;
          link_type: Database["public"]["Enums"]["nav_link_type"];
          parent_id?: string | null;
          sort_order?: number;
          target: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          label?: NonNullable<Json>;
          link_type?: Database["public"]["Enums"]["nav_link_type"];
          parent_id?: string | null;
          sort_order?: number;
          target?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nav_items_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "nav_items";
            referencedColumns: ["id"];
          },
        ];
      };
      objectives: {
        Row: {
          created_at: string;
          icon: string | null;
          id: string;
          is_active: boolean;
          sector_id: string | null;
          sort_order: number;
          text: NonNullable<Json>;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          icon?: string | null;
          id?: string;
          is_active?: boolean;
          sector_id?: string | null;
          sort_order?: number;
          text?: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          icon?: string | null;
          id?: string;
          is_active?: boolean;
          sector_id?: string | null;
          sort_order?: number;
          text?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "objectives_sector_id_fkey";
            columns: ["sector_id"];
            isOneToOne: false;
            referencedRelation: "sectors";
            referencedColumns: ["id"];
          },
        ];
      };
      page_sections: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          page_key: string;
          section_type: Database["public"]["Enums"]["section_type"];
          settings: NonNullable<Json>;
          sort_order: number;
          subtitle: NonNullable<Json>;
          title: NonNullable<Json>;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          page_key?: string;
          section_type: Database["public"]["Enums"]["section_type"];
          settings?: NonNullable<Json>;
          sort_order?: number;
          subtitle?: NonNullable<Json>;
          title?: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          page_key?: string;
          section_type?: Database["public"]["Enums"]["section_type"];
          settings?: NonNullable<Json>;
          sort_order?: number;
          subtitle?: NonNullable<Json>;
          title?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [];
      };
      pages: {
        Row: {
          body: NonNullable<Json>;
          cover_image: string | null;
          created_at: string;
          id: string;
          seo_description: NonNullable<Json>;
          show_in_nav: boolean;
          slug: string;
          status: Database["public"]["Enums"]["content_status"];
          title: NonNullable<Json>;
          updated_at: string;
        };
        Insert: {
          body?: NonNullable<Json>;
          cover_image?: string | null;
          created_at?: string;
          id?: string;
          seo_description?: NonNullable<Json>;
          show_in_nav?: boolean;
          slug: string;
          status?: Database["public"]["Enums"]["content_status"];
          title?: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          body?: NonNullable<Json>;
          cover_image?: string | null;
          created_at?: string;
          id?: string;
          seo_description?: NonNullable<Json>;
          show_in_nav?: boolean;
          slug?: string;
          status?: Database["public"]["Enums"]["content_status"];
          title?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [];
      };
      post_media: {
        Row: {
          caption: NonNullable<Json>;
          media_id: string;
          post_id: string;
          sort_order: number;
        };
        Insert: {
          caption?: NonNullable<Json>;
          media_id: string;
          post_id: string;
          sort_order?: number;
        };
        Update: {
          caption?: NonNullable<Json>;
          media_id?: string;
          post_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "post_media_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_media_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
        ];
      };
      post_sectors: {
        Row: {
          post_id: string;
          sector_id: string;
        };
        Insert: {
          post_id: string;
          sector_id: string;
        };
        Update: {
          post_id?: string;
          sector_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_sectors_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_sectors_sector_id_fkey";
            columns: ["sector_id"];
            isOneToOne: false;
            referencedRelation: "sectors";
            referencedColumns: ["id"];
          },
        ];
      };
      posts: {
        Row: {
          author_id: string | null;
          body: NonNullable<Json>;
          cover_media_id: string | null;
          created_at: string;
          event_date: string | null;
          excerpt: NonNullable<Json>;
          id: string;
          is_featured: boolean;
          kind: Database["public"]["Enums"]["post_kind"];
          location: Json | null;
          published_at: string | null;
          slug: string;
          status: Database["public"]["Enums"]["content_status"];
          title: NonNullable<Json>;
          updated_at: string;
        };
        Insert: {
          author_id?: string | null;
          body?: NonNullable<Json>;
          cover_media_id?: string | null;
          created_at?: string;
          event_date?: string | null;
          excerpt?: NonNullable<Json>;
          id?: string;
          is_featured?: boolean;
          kind?: Database["public"]["Enums"]["post_kind"];
          location?: Json | null;
          published_at?: string | null;
          slug: string;
          status?: Database["public"]["Enums"]["content_status"];
          title?: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          author_id?: string | null;
          body?: NonNullable<Json>;
          cover_media_id?: string | null;
          created_at?: string;
          event_date?: string | null;
          excerpt?: NonNullable<Json>;
          id?: string;
          is_featured?: boolean;
          kind?: Database["public"]["Enums"]["post_kind"];
          location?: Json | null;
          published_at?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["content_status"];
          title?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "posts_cover_media_id_fkey";
            columns: ["cover_media_id"];
            isOneToOne: false;
            referencedRelation: "media";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string;
          is_active: boolean;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string;
          is_active?: boolean;
          role: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          is_active?: boolean;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      request_events: {
        Row: {
          actor_id: string | null;
          created_at: string;
          data: NonNullable<Json>;
          event_type: string;
          from_status: Database["public"]["Enums"]["request_status"] | null;
          id: string;
          request_id: string;
          to_status: Database["public"]["Enums"]["request_status"] | null;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          data?: NonNullable<Json>;
          event_type: string;
          from_status?: Database["public"]["Enums"]["request_status"] | null;
          id?: string;
          request_id: string;
          to_status?: Database["public"]["Enums"]["request_status"] | null;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          data?: NonNullable<Json>;
          event_type?: string;
          from_status?: Database["public"]["Enums"]["request_status"] | null;
          id?: string;
          request_id?: string;
          to_status?: Database["public"]["Enums"]["request_status"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "request_events_request_id_fkey";
            columns: ["request_id"];
            isOneToOne: false;
            referencedRelation: "requests";
            referencedColumns: ["id"];
          },
        ];
      };
      request_status_lookups: {
        Row: {
          client_key: string;
          created_at: string;
          id: number;
          tracking_code: string;
        };
        Insert: {
          client_key: string;
          created_at?: string;
          id?: never;
          tracking_code: string;
        };
        Update: {
          client_key?: string;
          created_at?: string;
          id?: never;
          tracking_code?: string;
        };
        Relationships: [];
      };
      request_submit_log: {
        Row: {
          client_key: string;
          created_at: string;
          id: number;
        };
        Insert: {
          client_key: string;
          created_at?: string;
          id?: never;
        };
        Update: {
          client_key?: string;
          created_at?: string;
          id?: never;
        };
        Relationships: [];
      };
      request_types: {
        Row: {
          created_at: string;
          description: NonNullable<Json>;
          form_schema: NonNullable<Json>;
          icon: string | null;
          id: string;
          is_open: boolean;
          name: NonNullable<Json>;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: NonNullable<Json>;
          form_schema?: NonNullable<Json>;
          icon?: string | null;
          id?: string;
          is_open?: boolean;
          name?: NonNullable<Json>;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: NonNullable<Json>;
          form_schema?: NonNullable<Json>;
          icon?: string | null;
          id?: string;
          is_open?: boolean;
          name?: NonNullable<Json>;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      requests: {
        Row: {
          answers: NonNullable<Json>;
          assigned_to: string | null;
          consent_given: boolean;
          created_at: string;
          full_name: string;
          id: string;
          locale: string;
          phone: string;
          priority: Database["public"]["Enums"]["request_priority"];
          public_note: string | null;
          region: string | null;
          status: Database["public"]["Enums"]["request_status"];
          tracking_code: string;
          type_id: string;
          updated_at: string;
        };
        Insert: {
          answers?: NonNullable<Json>;
          assigned_to?: string | null;
          consent_given: boolean;
          created_at?: string;
          full_name: string;
          id?: string;
          locale: string;
          phone: string;
          priority?: Database["public"]["Enums"]["request_priority"];
          public_note?: string | null;
          region?: string | null;
          status?: Database["public"]["Enums"]["request_status"];
          tracking_code?: string;
          type_id: string;
          updated_at?: string;
        };
        Update: {
          answers?: NonNullable<Json>;
          assigned_to?: string | null;
          consent_given?: boolean;
          created_at?: string;
          full_name?: string;
          id?: string;
          locale?: string;
          phone?: string;
          priority?: Database["public"]["Enums"]["request_priority"];
          public_note?: string | null;
          region?: string | null;
          status?: Database["public"]["Enums"]["request_status"];
          tracking_code?: string;
          type_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "requests_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["user_id"];
          },
          {
            foreignKeyName: "requests_type_id_fkey";
            columns: ["type_id"];
            isOneToOne: false;
            referencedRelation: "request_types";
            referencedColumns: ["id"];
          },
        ];
      };
      sectors: {
        Row: {
          color: string | null;
          cover_image: string | null;
          created_at: string;
          description: NonNullable<Json>;
          icon: string | null;
          id: string;
          is_active: boolean;
          name: NonNullable<Json>;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          color?: string | null;
          cover_image?: string | null;
          created_at?: string;
          description?: NonNullable<Json>;
          icon?: string | null;
          id?: string;
          is_active?: boolean;
          name?: NonNullable<Json>;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          color?: string | null;
          cover_image?: string | null;
          created_at?: string;
          description?: NonNullable<Json>;
          icon?: string | null;
          id?: string;
          is_active?: boolean;
          name?: NonNullable<Json>;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      site_settings: {
        Row: {
          address: NonNullable<Json>;
          created_at: string;
          donate_info: NonNullable<Json>;
          email: string | null;
          favicon_url: string | null;
          footer_text: NonNullable<Json>;
          id: number;
          logo_dark_url: string | null;
          logo_url: string | null;
          map_embed_url: string | null;
          modules: NonNullable<Json>;
          org_name: NonNullable<Json>;
          phone: string | null;
          socials: NonNullable<Json>;
          tagline: NonNullable<Json>;
          updated_at: string;
          whatsapp: string | null;
        };
        Insert: {
          address?: NonNullable<Json>;
          created_at?: string;
          donate_info?: NonNullable<Json>;
          email?: string | null;
          favicon_url?: string | null;
          footer_text?: NonNullable<Json>;
          id?: number;
          logo_dark_url?: string | null;
          logo_url?: string | null;
          map_embed_url?: string | null;
          modules?: NonNullable<Json>;
          org_name?: NonNullable<Json>;
          phone?: string | null;
          socials?: NonNullable<Json>;
          tagline?: NonNullable<Json>;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Update: {
          address?: NonNullable<Json>;
          created_at?: string;
          donate_info?: NonNullable<Json>;
          email?: string | null;
          favicon_url?: string | null;
          footer_text?: NonNullable<Json>;
          id?: number;
          logo_dark_url?: string | null;
          logo_url?: string | null;
          map_embed_url?: string | null;
          modules?: NonNullable<Json>;
          org_name?: NonNullable<Json>;
          phone?: string | null;
          socials?: NonNullable<Json>;
          tagline?: NonNullable<Json>;
          updated_at?: string;
          whatsapp?: string | null;
        };
        Relationships: [];
      };
      theme: {
        Row: {
          accent_color: string;
          background_color: string;
          created_at: string;
          font_arabic: string;
          font_latin: string;
          footer_style: string;
          header_style: string;
          id: number;
          primary_color: string;
          radius: string;
          secondary_color: string;
          text_color: string;
          updated_at: string;
        };
        Insert: {
          accent_color?: string;
          background_color?: string;
          created_at?: string;
          font_arabic?: string;
          font_latin?: string;
          footer_style?: string;
          header_style?: string;
          id?: number;
          primary_color?: string;
          radius?: string;
          secondary_color?: string;
          text_color?: string;
          updated_at?: string;
        };
        Update: {
          accent_color?: string;
          background_color?: string;
          created_at?: string;
          font_arabic?: string;
          font_latin?: string;
          footer_style?: string;
          header_style?: string;
          id?: number;
          primary_color?: string;
          radius?: string;
          secondary_color?: string;
          text_color?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      ui_strings: {
        Row: {
          created_at: string;
          key: string;
          updated_at: string;
          value: NonNullable<Json>;
        };
        Insert: {
          created_at?: string;
          key: string;
          updated_at?: string;
          value?: NonNullable<Json>;
        };
        Update: {
          created_at?: string;
          key?: string;
          updated_at?: string;
          value?: NonNullable<Json>;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      check_request_status: {
        Args: { p_phone: string; p_tracking_code: string };
        Returns: {
          public_note: string;
          status: Database["public"]["Enums"]["request_status"];
          tracking_code: string;
          type_name: Json;
          updated_at: string;
        }[];
      };
      current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      generate_tracking_code: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_case_worker: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_editor: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_post_public: { Args: { p_post_id: string }; Returns: boolean };
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
      requests_enabled: { Args: Record<PropertyKey, never>; Returns: boolean };
      set_post_links: {
        Args: { p_album: Json; p_post_id: string; p_sector_ids: string[] };
        Returns: undefined;
      };
      submit_request: {
        Args: {
          p_answers: Json;
          p_consent: boolean;
          p_full_name: string;
          p_locale: string;
          p_phone: string;
          p_type_slug: string;
        };
        Returns: string;
      };
      tr: { Args: { field: Json; locale: string }; Returns: string };
    };
    Enums: {
      content_status: "draft" | "published";
      nav_link_type: "page" | "sector" | "route" | "external";
      post_kind: "activity" | "event" | "news";
      request_priority: "low" | "normal" | "high" | "urgent";
      request_status:
        "new" | "in_review" | "approved" | "rejected" | "fulfilled" | "closed";
      section_type:
        | "hero_slider"
        | "about_intro"
        | "objectives"
        | "sectors_grid"
        | "latest_activities"
        | "events_strip"
        | "stats"
        | "gallery"
        | "partners"
        | "cta_banner"
        | "facebook_feed"
        | "request_cta"
        | "rich_text";
      text_dir: "rtl" | "ltr";
      user_role: "admin" | "editor" | "case_worker";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      content_status: ["draft", "published"],
      nav_link_type: ["page", "sector", "route", "external"],
      post_kind: ["activity", "event", "news"],
      request_priority: ["low", "normal", "high", "urgent"],
      request_status: [
        "new",
        "in_review",
        "approved",
        "rejected",
        "fulfilled",
        "closed",
      ],
      section_type: [
        "hero_slider",
        "about_intro",
        "objectives",
        "sectors_grid",
        "latest_activities",
        "events_strip",
        "stats",
        "gallery",
        "partners",
        "cta_banner",
        "facebook_feed",
        "request_cta",
        "rich_text",
      ],
      text_dir: ["rtl", "ltr"],
      user_role: ["admin", "editor", "case_worker"],
    },
  },
} as const;
