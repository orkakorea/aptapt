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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          is_active: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          is_active?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          is_active?: boolean
          user_id?: string
        }
        Relationships: []
      }
      inquiries: {
        Row: {
          admin_memo: string | null
          admin_notes: string | null
          apt_id: string | null
          apt_name: string | null
          assignee: string | null
          campaign_type: string | null
          cart_snapshot: Json | null
          company: string | null
          created_at: string
          created_by: string | null
          customer_name: string | null
          email: string | null
          extra: Json | null
          id: string
          inquiry_kind: string
          memo: string | null
          message: string | null
          name: string | null
          phone: string | null
          processed_at: string | null
          product_code: string | null
          product_name: string | null
          promo_code: string | null
          public_view_token: string
          source_page: string | null
          status: string | null
          ticket_code: string | null
          utm: Json | null
          valid: boolean | null
        }
        Insert: {
          admin_memo?: string | null
          admin_notes?: string | null
          apt_id?: string | null
          apt_name?: string | null
          assignee?: string | null
          campaign_type?: string | null
          cart_snapshot?: Json | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          email?: string | null
          extra?: Json | null
          id?: string
          inquiry_kind: string
          memo?: string | null
          message?: string | null
          name?: string | null
          phone?: string | null
          processed_at?: string | null
          product_code?: string | null
          product_name?: string | null
          promo_code?: string | null
          public_view_token?: string
          source_page?: string | null
          status?: string | null
          ticket_code?: string | null
          utm?: Json | null
          valid?: boolean | null
        }
        Update: {
          admin_memo?: string | null
          admin_notes?: string | null
          apt_id?: string | null
          apt_name?: string | null
          assignee?: string | null
          campaign_type?: string | null
          cart_snapshot?: Json | null
          company?: string | null
          created_at?: string
          created_by?: string | null
          customer_name?: string | null
          email?: string | null
          extra?: Json | null
          id?: string
          inquiry_kind?: string
          memo?: string | null
          message?: string | null
          name?: string | null
          phone?: string | null
          processed_at?: string | null
          product_code?: string | null
          product_name?: string | null
          promo_code?: string | null
          public_view_token?: string
          source_page?: string | null
          status?: string | null
          ticket_code?: string | null
          utm?: Json | null
          valid?: boolean | null
        }
        Relationships: []
      }
      inquiry_audit_logs: {
        Row: {
          action: string
          actor: string | null
          created_at: string | null
          from_value: string | null
          id: number
          inquiry_id: string
          ip: unknown
          payload: Json | null
          reason: string | null
          success: boolean
          to_value: string | null
          ua: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string | null
          from_value?: string | null
          id?: number
          inquiry_id: string
          ip?: unknown
          payload?: Json | null
          reason?: string | null
          success?: boolean
          to_value?: string | null
          ua?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string | null
          from_value?: string | null
          id?: number
          inquiry_id?: string
          ip?: unknown
          payload?: Json | null
          reason?: string | null
          success?: boolean
          to_value?: string | null
          ua?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_audit_logs_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_rate_limits: {
        Row: {
          hits: number
          id: number
          ip: unknown
          window_start: string
        }
        Insert: {
          hits?: number
          id?: number
          ip: unknown
          window_start?: string
        }
        Update: {
          hits?: number
          id?: number
          ip?: unknown
          window_start?: string
        }
        Relationships: []
      }
      notification_jobs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          kind: string
          payload: Json
          sent_at: string | null
          status: string
          target: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          kind: string
          payload?: Json
          sent_at?: string | null
          status?: string
          target: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          kind?: string
          payload?: Json
          sent_at?: string | null
          status?: string
          target?: string
        }
        Relationships: []
      }
      places_old_20250917_034408: {
        Row: {
          address: string | null
          created_at: string | null
          fee: number | null
          geocode_status: string | null
          hours: string | null
          households: number | null
          id: number
          lat: number | null
          lng: number | null
          monitors: number | null
          name: string | null
          plays_per_month: number | null
          product: string | null
          residents: number | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          fee?: number | null
          geocode_status?: string | null
          hours?: string | null
          households?: number | null
          id?: number
          lat?: number | null
          lng?: number | null
          monitors?: number | null
          name?: string | null
          plays_per_month?: number | null
          product?: string | null
          residents?: number | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          fee?: number | null
          geocode_status?: string | null
          hours?: string | null
          households?: number | null
          id?: number
          lat?: number | null
          lng?: number | null
          monitors?: number | null
          name?: string | null
          plays_per_month?: number | null
          product?: string | null
          residents?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      public_map_places_backup_20251112_083752: {
        Row: {
          city: string | null
          district: string | null
          image_url: string | null
          is_active: boolean
          lat: number
          lng: number
          name: string | null
          place_id: number
          product_name: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          district?: string | null
          image_url?: string | null
          is_active?: boolean
          lat: number
          lng: number
          name?: string | null
          place_id: number
          product_name?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          district?: string | null
          image_url?: string | null
          is_active?: boolean
          lat?: number
          lng?: number
          name?: string | null
          place_id?: number
          product_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      public_map_places_backup_251108: {
        Row: {
          city: string | null
          district: string | null
          image_url: string | null
          is_active: boolean | null
          lat: number | null
          lng: number | null
          name: string | null
          place_id: number | null
          product_name: string | null
          updated_at: string | null
        }
        Insert: {
          city?: string | null
          district?: string | null
          image_url?: string | null
          is_active?: boolean | null
          lat?: number | null
          lng?: number | null
          name?: string | null
          place_id?: number | null
          product_name?: string | null
          updated_at?: string | null
        }
        Update: {
          city?: string | null
          district?: string | null
          image_url?: string | null
          is_active?: boolean | null
          lat?: number | null
          lng?: number | null
          name?: string | null
          place_id?: number | null
          product_name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      raw_places: {
        Row: {
          "1회당 송출비용": string | null
          biz_key: string | null
          created_at: string | null
          geocode_status: string | null
          id: number
          is_active: boolean
          lat: number | null
          lng: number | null
          row_hash: string | null
          거주인원: string | null
          단지명: string | null
          모니터수량: string | null
          상품명: string | null
          설치위치: string | null
          세대수: string | null
          운영시간: string | null
          월광고료: string | null
          월송출횟수: string | null
          주소: string | null
        }
        Insert: {
          "1회당 송출비용"?: string | null
          biz_key?: string | null
          created_at?: string | null
          geocode_status?: string | null
          id?: number
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          row_hash?: string | null
          거주인원?: string | null
          단지명?: string | null
          모니터수량?: string | null
          상품명?: string | null
          설치위치?: string | null
          세대수?: string | null
          운영시간?: string | null
          월광고료?: string | null
          월송출횟수?: string | null
          주소?: string | null
        }
        Update: {
          "1회당 송출비용"?: string | null
          biz_key?: string | null
          created_at?: string | null
          geocode_status?: string | null
          id?: number
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          row_hash?: string | null
          거주인원?: string | null
          단지명?: string | null
          모니터수량?: string | null
          상품명?: string | null
          설치위치?: string | null
          세대수?: string | null
          운영시간?: string | null
          월광고료?: string | null
          월송출횟수?: string | null
          주소?: string | null
        }
        Relationships: []
      }
      raw_places_backup_251108: {
        Row: {
          "1회당 송출비용": string | null
          biz_key: string | null
          created_at: string | null
          geocode_status: string | null
          id: number | null
          is_active: boolean | null
          lat: number | null
          lng: number | null
          row_hash: string | null
          거주인원: string | null
          단지명: string | null
          모니터수량: string | null
          상품명: string | null
          설치위치: string | null
          세대수: string | null
          운영시간: string | null
          월광고료: string | null
          월송출횟수: string | null
          주소: string | null
        }
        Insert: {
          "1회당 송출비용"?: string | null
          biz_key?: string | null
          created_at?: string | null
          geocode_status?: string | null
          id?: number | null
          is_active?: boolean | null
          lat?: number | null
          lng?: number | null
          row_hash?: string | null
          거주인원?: string | null
          단지명?: string | null
          모니터수량?: string | null
          상품명?: string | null
          설치위치?: string | null
          세대수?: string | null
          운영시간?: string | null
          월광고료?: string | null
          월송출횟수?: string | null
          주소?: string | null
        }
        Update: {
          "1회당 송출비용"?: string | null
          biz_key?: string | null
          created_at?: string | null
          geocode_status?: string | null
          id?: number | null
          is_active?: boolean | null
          lat?: number | null
          lng?: number | null
          row_hash?: string | null
          거주인원?: string | null
          단지명?: string | null
          모니터수량?: string | null
          상품명?: string | null
          설치위치?: string | null
          세대수?: string | null
          운영시간?: string | null
          월광고료?: string | null
          월송출횟수?: string | null
          주소?: string | null
        }
        Relationships: []
      }
      raw_places_bak_20251112_v5: {
        Row: {
          "1회당 송출비용": string | null
          biz_key: string | null
          created_at: string | null
          geocode_status: string | null
          id: number | null
          is_active: boolean | null
          lat: number | null
          lng: number | null
          row_hash: string | null
          거주인원: string | null
          단지명: string | null
          모니터수량: string | null
          상품명: string | null
          설치위치: string | null
          세대수: string | null
          운영시간: string | null
          월광고료: string | null
          월송출횟수: string | null
          주소: string | null
        }
        Insert: {
          "1회당 송출비용"?: string | null
          biz_key?: string | null
          created_at?: string | null
          geocode_status?: string | null
          id?: number | null
          is_active?: boolean | null
          lat?: number | null
          lng?: number | null
          row_hash?: string | null
          거주인원?: string | null
          단지명?: string | null
          모니터수량?: string | null
          상품명?: string | null
          설치위치?: string | null
          세대수?: string | null
          운영시간?: string | null
          월광고료?: string | null
          월송출횟수?: string | null
          주소?: string | null
        }
        Update: {
          "1회당 송출비용"?: string | null
          biz_key?: string | null
          created_at?: string | null
          geocode_status?: string | null
          id?: number | null
          is_active?: boolean | null
          lat?: number | null
          lng?: number | null
          row_hash?: string | null
          거주인원?: string | null
          단지명?: string | null
          모니터수량?: string | null
          상품명?: string | null
          설치위치?: string | null
          세대수?: string | null
          운영시간?: string | null
          월광고료?: string | null
          월송출횟수?: string | null
          주소?: string | null
        }
        Relationships: []
      }
      raw_places_stage: {
        Row: {
          "1회당 송출비용": string | null
          biz_key: string | null
          created_at: string | null
          geocode_status: string | null
          id: number
          is_active: boolean
          lat: number | null
          lng: number | null
          row_hash: string | null
          거주인원: string | null
          단지명: string | null
          모니터수량: string | null
          상품명: string | null
          설치위치: string | null
          세대수: string | null
          운영시간: string | null
          월광고료: string | null
          월송출횟수: string | null
          주소: string | null
        }
        Insert: {
          "1회당 송출비용"?: string | null
          biz_key?: string | null
          created_at?: string | null
          geocode_status?: string | null
          id?: number
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          row_hash?: string | null
          거주인원?: string | null
          단지명?: string | null
          모니터수량?: string | null
          상품명?: string | null
          설치위치?: string | null
          세대수?: string | null
          운영시간?: string | null
          월광고료?: string | null
          월송출횟수?: string | null
          주소?: string | null
        }
        Update: {
          "1회당 송출비용"?: string | null
          biz_key?: string | null
          created_at?: string | null
          geocode_status?: string | null
          id?: number
          is_active?: boolean
          lat?: number | null
          lng?: number | null
          row_hash?: string | null
          거주인원?: string | null
          단지명?: string | null
          모니터수량?: string | null
          상품명?: string | null
          설치위치?: string | null
          세대수?: string | null
          운영시간?: string | null
          월광고료?: string | null
          월송출횟수?: string | null
          주소?: string | null
        }
        Relationships: []
      }
      raw_places_stg_251108: {
        Row: {
          "1회당 송출비용": number | null
          geocode_status: string | null
          ingested_at: string | null
          lat: number | null
          lng: number | null
          source_updated_at: string | null
          거주인원: number | null
          단지명: string | null
          모니터수량: number | null
          상품명: string | null
          설치위치: string | null
          세대수: number | null
          운영시간: string | null
          월광고료: number | null
          월송출횟수: number | null
          주소: string | null
        }
        Insert: {
          "1회당 송출비용"?: number | null
          geocode_status?: string | null
          ingested_at?: string | null
          lat?: number | null
          lng?: number | null
          source_updated_at?: string | null
          거주인원?: number | null
          단지명?: string | null
          모니터수량?: number | null
          상품명?: string | null
          설치위치?: string | null
          세대수?: number | null
          운영시간?: string | null
          월광고료?: number | null
          월송출횟수?: number | null
          주소?: string | null
        }
        Update: {
          "1회당 송출비용"?: number | null
          geocode_status?: string | null
          ingested_at?: string | null
          lat?: number | null
          lng?: number | null
          source_updated_at?: string | null
          거주인원?: number | null
          단지명?: string | null
          모니터수량?: number | null
          상품명?: string | null
          설치위치?: string | null
          세대수?: number | null
          운영시간?: string | null
          월광고료?: number | null
          월송출횟수?: number | null
          주소?: string | null
        }
        Relationships: []
      }
      raw_places_stg_251108_bak_20251112_v5: {
        Row: {
          "1회당 송출비용": number | null
          geocode_status: string | null
          ingested_at: string | null
          lat: number | null
          lng: number | null
          source_updated_at: string | null
          거주인원: number | null
          단지명: string | null
          모니터수량: number | null
          상품명: string | null
          설치위치: string | null
          세대수: number | null
          운영시간: string | null
          월광고료: number | null
          월송출횟수: number | null
          주소: string | null
        }
        Insert: {
          "1회당 송출비용"?: number | null
          geocode_status?: string | null
          ingested_at?: string | null
          lat?: number | null
          lng?: number | null
          source_updated_at?: string | null
          거주인원?: number | null
          단지명?: string | null
          모니터수량?: number | null
          상품명?: string | null
          설치위치?: string | null
          세대수?: number | null
          운영시간?: string | null
          월광고료?: number | null
          월송출횟수?: number | null
          주소?: string | null
        }
        Update: {
          "1회당 송출비용"?: number | null
          geocode_status?: string | null
          ingested_at?: string | null
          lat?: number | null
          lng?: number | null
          source_updated_at?: string | null
          거주인원?: number | null
          단지명?: string | null
          모니터수량?: number | null
          상품명?: string | null
          설치위치?: string | null
          세대수?: number | null
          운영시간?: string | null
          월광고료?: number | null
          월송출횟수?: number | null
          주소?: string | null
        }
        Relationships: []
      }
      raw_places_stg_text_251108: {
        Row: {
          "1회당 송출비용": string | null
          geocode_status: string | null
          lat: string | null
          lng: string | null
          거주인원: string | null
          단지명: string | null
          모니터수량: string | null
          상품명: string | null
          설치위치: string | null
          세대수: string | null
          운영시간: string | null
          월광고료: string | null
          월송출횟수: string | null
          주소: string | null
        }
        Insert: {
          "1회당 송출비용"?: string | null
          geocode_status?: string | null
          lat?: string | null
          lng?: string | null
          거주인원?: string | null
          단지명?: string | null
          모니터수량?: string | null
          상품명?: string | null
          설치위치?: string | null
          세대수?: string | null
          운영시간?: string | null
          월광고료?: string | null
          월송출횟수?: string | null
          주소?: string | null
        }
        Update: {
          "1회당 송출비용"?: string | null
          geocode_status?: string | null
          lat?: string | null
          lng?: string | null
          거주인원?: string | null
          단지명?: string | null
          모니터수량?: string | null
          상품명?: string | null
          설치위치?: string | null
          세대수?: string | null
          운영시간?: string | null
          월광고료?: string | null
          월송출횟수?: string | null
          주소?: string | null
        }
        Relationships: []
      }
      raw_places_stg_text_251108_bak_20251112: {
        Row: {
          "1회당 송출비용": string | null
          geocode_status: string | null
          lat: string | null
          lng: string | null
          거주인원: string | null
          단지명: string | null
          모니터수량: string | null
          상품명: string | null
          설치위치: string | null
          세대수: string | null
          운영시간: string | null
          월광고료: string | null
          월송출횟수: string | null
          주소: string | null
        }
        Insert: {
          "1회당 송출비용"?: string | null
          geocode_status?: string | null
          lat?: string | null
          lng?: string | null
          거주인원?: string | null
          단지명?: string | null
          모니터수량?: string | null
          상품명?: string | null
          설치위치?: string | null
          세대수?: string | null
          운영시간?: string | null
          월광고료?: string | null
          월송출횟수?: string | null
          주소?: string | null
        }
        Update: {
          "1회당 송출비용"?: string | null
          geocode_status?: string | null
          lat?: string | null
          lng?: string | null
          거주인원?: string | null
          단지명?: string | null
          모니터수량?: string | null
          상품명?: string | null
          설치위치?: string | null
          세대수?: string | null
          운영시간?: string | null
          월광고료?: string | null
          월송출횟수?: string | null
          주소?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          id: string
          is_active: boolean
          note: string | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["role_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          id?: string
          is_active?: boolean
          note?: string | null
          revoked_at?: string | null
          role: Database["public"]["Enums"]["role_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          id?: string
          is_active?: boolean
          note?: string | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["role_type"]
          user_id?: string
        }
        Relationships: []
      }
      user_roles_audit: {
        Row: {
          action: string
          actor_jwt_role: string | null
          actor_uid: string | null
          id: number
          new_row: Json | null
          old_row: Json | null
          ts: string
        }
        Insert: {
          action: string
          actor_jwt_role?: string | null
          actor_uid?: string | null
          id?: number
          new_row?: Json | null
          old_row?: Json | null
          ts?: string
        }
        Update: {
          action?: string
          actor_jwt_role?: string | null
          actor_uid?: string | null
          id?: number
          new_row?: Json | null
          old_row?: Json | null
          ts?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_map_places: {
        Row: {
          address: string | null
          city: string | null
          cost_per_play: number | null
          district: string | null
          hours: string | null
          households: number | null
          image_url: string | null
          install_location: string | null
          is_active: boolean | null
          lat: number | null
          lng: number | null
          monitors: number | null
          monthly_fee: number | null
          monthly_fee_y1: number | null
          monthly_impressions: number | null
          name: string | null
          place_id: string | null
          product_name: string | null
          residents: number | null
          row_uid: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      raw_places_for_map: {
        Row: {
          "1회당 송출비용": string | null
          created_at: string | null
          dup_count: number | null
          geocode_status: string | null
          id: number | null
          lat: number | null
          lat_j: number | null
          lng: number | null
          lng_j: number | null
          rn: number | null
          거주인원: string | null
          단지명: string | null
          모니터수량: string | null
          상품명: string | null
          설치위치: string | null
          세대수: string | null
          운영시간: string | null
          월광고료: string | null
          월송출횟수: string | null
          주소: string | null
        }
        Relationships: []
      }
      raw_places_stg_norm_251108: {
        Row: {
          "1회당 송출비용": number | null
          biz_key: string | null
          geocode_status: string | null
          lat: number | null
          lng: number | null
          거주인원: number | null
          단지명: string | null
          모니터수량: number | null
          상품명: string | null
          설치위치: string | null
          세대수: number | null
          운영시간: string | null
          월광고료: number | null
          월송출횟수: number | null
          주소: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _norm_txt: { Args: { s: string }; Returns: string }
      _only_digits: { Args: { s: string }; Returns: string }
      auth_has_role: {
        Args: { target: Database["public"]["Enums"]["role_type"] }
        Returns: boolean
      }
      auth_role: { Args: never; Returns: string }
      get_my_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["role_type"][]
      }
      get_public_map_places:
        | {
            Args: {
              limit_n?: number
              max_lat: number
              max_lng: number
              min_lat: number
              min_lng: number
            }
            Returns: {
              id: string
              imageUrl: string
              lat: number
              lng: number
              name: string
              productName: string
            }[]
          }
        | {
            Args: { params?: Json }
            Returns: {
              address: string
              cost_per_play: number
              created_at: string
              geocode_status: string
              hours: string
              households: number
              id: number
              install_location: string
              lat: number
              lng: number
              monitors: number
              monthly_fee: number
              monthly_impressions: number
              name: string
              product_name: string
              residents: number
            }[]
          }
        | {
            Args: {
              east?: number
              limit_count?: number
              north?: number
              q?: string
              south?: number
              west?: number
            }
            Returns: {
              address: string
              cost_per_play: number
              created_at: string
              geocode_status: string
              hours: string
              households: number
              id: number
              install_location: string
              lat: number
              lng: number
              monitors: number
              monthly_fee: number
              monthly_impressions: number
              name: string
              product_name: string
              residents: number
            }[]
          }
      get_public_map_places_b: {
        Args: {
          p_limit?: number
          p_max_lat: number
          p_max_lng: number
          p_min_lat: number
          p_min_lng: number
        }
        Returns: {
          address: string
          city: string
          cost_per_play: number
          district: string
          hours: string
          households: number
          image_url: string
          install_location: string
          lat: number
          lng: number
          monitors: number
          monthly_fee: number
          monthly_fee_y1: number
          monthly_impressions: number
          name: string
          place_id: string
          product_name: string
          residents: number
          updated_at: string
        }[]
      }
      get_public_map_places_v2: {
        Args: {
          p_limit?: number
          p_max_lat: number
          p_max_lng: number
          p_min_lat: number
          p_min_lng: number
        }
        Returns: {
          address: string
          city: string
          cost_per_play: number
          district: string
          hours: string
          households: number
          image_url: string
          install_location: string
          lat: number
          lng: number
          monitors: number
          monthly_fee: number
          monthly_fee_y1: number
          monthly_impressions: number
          name: string
          place_id: string
          product_name: string
          residents: number
          updated_at: string
        }[]
      }
      get_public_place_detail:
        | {
            Args: { p_place_id: number }
            Returns: {
              address: string
              cost_per_play: number
              created_at: string
              geocode_status: string
              hours: string
              households: number
              id: number
              install_location: string
              lat: number
              lng: number
              monitors: number
              monthly_fee: number
              monthly_impressions: number
              name: string
              product_name: string
              residents: number
            }[]
          }
        | {
            Args: {
              id?: number
              install_location?: string
              name?: string
              product_name?: string
            }
            Returns: {
              address: string
              cost_per_play: number
              created_at: string
              geocode_status: string
              hours: string
              households: number
              id: number
              install_location: string
              lat: number
              lng: number
              monitors: number
              monthly_fee: number
              monthly_impressions: number
              name: string
              product_name: string
              residents: number
            }[]
          }
      get_public_place_detail_b: {
        Args: { p_place_id: string }
        Returns: {
          address: string
          city: string
          cost_per_play: number
          district: string
          hours: string
          households: number
          image_url: string
          install_location: string
          lat: number
          lng: number
          monitors: number
          monthly_fee: number
          monthly_fee_y1: number
          monthly_impressions: number
          name: string
          place_id: string
          product_name: string
          residents: number
          updated_at: string
        }[]
      }
      get_public_place_stats_by_names: {
        Args: { p_names: string[] }
        Returns: {
          households: number
          monitors: number
          monthly_impressions: number
          name: string
          residents: number
        }[]
      }
      get_public_places: {
        Args: never
        Returns: {
          apt_name: string
          dong: string
          gu: string
          id: string
          lat: number
          lng: number
          si: string
        }[]
      }
      inquiries_submit: { Args: { payload: Json }; Returns: Json }
      is_admin:
        | { Args: never; Returns: boolean }
        | { Args: { uid: string }; Returns: boolean }
      is_service_role: { Args: never; Returns: boolean }
      submit_inquiry: { Args: { p_payload: Json }; Returns: string }
    }
    Enums: {
      role_type: "admin" | "staff" | "pro" | "free"
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
      role_type: ["admin", "staff", "pro", "free"],
    },
  },
} as const
