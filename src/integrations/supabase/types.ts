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
      buses: {
        Row: {
          chauffeur: string | null
          created_at: string
          id: string
          immatriculation: string
          statut: string
          type: string
          updated_at: string
        }
        Insert: {
          chauffeur?: string | null
          created_at?: string
          id?: string
          immatriculation: string
          statut?: string
          type?: string
          updated_at?: string
        }
        Update: {
          chauffeur?: string | null
          created_at?: string
          id?: string
          immatriculation?: string
          statut?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      circuit_activities: {
        Row: {
          circuit_id: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          circuit_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          price?: number
          sort_order?: number
        }
        Update: {
          circuit_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "circuit_activities_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
        ]
      }
      circuits: {
        Row: {
          base_price: number
          created_at: string
          description: string
          duration_days: number
          guide_price: number
          id: string
          image_url: string | null
          includes_guide: boolean
          includes_lodging: boolean
          is_active: boolean
          lodging_price: number
          nom: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          base_price?: number
          created_at?: string
          description?: string
          duration_days?: number
          guide_price?: number
          id?: string
          image_url?: string | null
          includes_guide?: boolean
          includes_lodging?: boolean
          is_active?: boolean
          lodging_price?: number
          nom: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          base_price?: number
          created_at?: string
          description?: string
          duration_days?: number
          guide_price?: number
          id?: string
          image_url?: string | null
          includes_guide?: boolean
          includes_lodging?: boolean
          is_active?: boolean
          lodging_price?: number
          nom?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      client_positions: {
        Row: {
          accuracy: number | null
          archived_at: string | null
          client_id: string
          heading: number | null
          latitude: number
          longitude: number
          speed: number | null
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          archived_at?: string | null
          client_id: string
          heading?: number | null
          latitude: number
          longitude: number
          speed?: number | null
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          archived_at?: string | null
          client_id?: string
          heading?: number | null
          latitude?: number
          longitude?: number
          speed?: number | null
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_positions_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_positions: {
        Row: {
          accuracy: number | null
          archived_at: string | null
          driver_id: string
          heading: number | null
          latitude: number
          longitude: number
          speed: number | null
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          accuracy?: number | null
          archived_at?: string | null
          driver_id: string
          heading?: number | null
          latitude: number
          longitude: number
          speed?: number | null
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          accuracy?: number | null
          archived_at?: string | null
          driver_id?: string
          heading?: number | null
          latitude?: number
          longitude?: number
          speed?: number | null
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_positions_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          created_at: string
          description: string
          id: string
          image_url: string | null
          is_active: boolean
          price: number
          service_type: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          price?: number
          service_type?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          price?: number
          service_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          admin_comment: string | null
          amount: number
          archived_at: string | null
          created_at: string
          id: string
          method: string
          receipt_url: string | null
          reservation_id: string
          status: Database["public"]["Enums"]["payment_status"]
          transaction_ref: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_comment?: string | null
          amount: number
          archived_at?: string | null
          created_at?: string
          id?: string
          method?: string
          receipt_url?: string | null
          reservation_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_ref?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_comment?: string | null
          amount?: number
          archived_at?: string | null
          created_at?: string
          id?: string
          method?: string
          receipt_url?: string | null
          reservation_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          transaction_ref?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          archived_at: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          admin_comment: string | null
          archived_at: string | null
          created_at: string
          details: Json
          id: string
          paid_amount: number
          paiement_valide: boolean
          reservation_date: string
          service_type: Database["public"]["Enums"]["service_type"]
          status: Database["public"]["Enums"]["reservation_status"]
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_comment?: string | null
          archived_at?: string | null
          created_at?: string
          details?: Json
          id?: string
          paid_amount?: number
          paiement_valide?: boolean
          reservation_date: string
          service_type: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["reservation_status"]
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_comment?: string | null
          archived_at?: string | null
          created_at?: string
          details?: Json
          id?: string
          paid_amount?: number
          paiement_valide?: boolean
          reservation_date?: string
          service_type?: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["reservation_status"]
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      rides: {
        Row: {
          created_at: string
          created_by: string
          destination: string
          driver_id: string | null
          id: string
          notes: string | null
          pickup: string
          price: number
          scheduled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          destination: string
          driver_id?: string | null
          id?: string
          notes?: string | null
          pickup: string
          price?: number
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          destination?: string
          driver_id?: string | null
          id?: string
          notes?: string | null
          pickup?: string
          price?: number
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      transport_activities: {
        Row: {
          created_at: string
          description: string
          duration_hours: number
          id: string
          is_active: boolean
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          duration_hours?: number
          id?: string
          is_active?: boolean
          name: string
          price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          duration_hours?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      transport_categories: {
        Row: {
          created_at: string
          description: string
          icon: string
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      transport_packages: {
        Row: {
          activity_id: string | null
          created_at: string
          description: string
          id: string
          is_active: boolean
          name: string
          price: number
          route_id: string | null
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          route_id?: string | null
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          route_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_packages_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "transport_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_packages_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "transport_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_pricing: {
        Row: {
          created_at: string
          id: string
          price: number
          route_id: string
          service_type: string
          trip_type: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          price?: number
          route_id: string
          service_type?: string
          trip_type?: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          price?: number
          route_id?: string
          service_type?: string
          trip_type?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_pricing_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "transport_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_pricing_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "transport_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_routes: {
        Row: {
          category_id: string
          created_at: string
          destination: string
          distance_km: number
          id: string
          is_active: boolean
          name: string
          origin: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          destination: string
          distance_km?: number
          id?: string
          is_active?: boolean
          name: string
          origin: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          destination?: string
          distance_km?: number
          id?: string
          is_active?: boolean
          name?: string
          origin?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_routes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "transport_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_settings: {
        Row: {
          description: string
          id: string
          key: string
          label: string
          text_value: string | null
          updated_at: string
          value: number
        }
        Insert: {
          description?: string
          id?: string
          key: string
          label?: string
          text_value?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
          description?: string
          id?: string
          key?: string
          label?: string
          text_value?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      transport_vehicles: {
        Row: {
          base_price: number
          capacity: number
          created_at: string
          description: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          base_price?: number
          capacity: number
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          capacity?: number
          created_at?: string
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          archived_at: string | null
          client_id: string
          completed_at: string | null
          created_at: string
          destination_address: string
          destination_lat: number | null
          destination_lng: number | null
          driver_id: string | null
          eta_minutes: number | null
          gerant_id: string | null
          id: string
          origin_address: string
          origin_lat: number | null
          origin_lng: number | null
          reservation_id: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          client_id: string
          completed_at?: string | null
          created_at?: string
          destination_address?: string
          destination_lat?: number | null
          destination_lng?: number | null
          driver_id?: string | null
          eta_minutes?: number | null
          gerant_id?: string | null
          id?: string
          origin_address?: string
          origin_lat?: number | null
          origin_lng?: number | null
          reservation_id: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          client_id?: string
          completed_at?: string | null
          created_at?: string
          destination_address?: string
          destination_lat?: number | null
          destination_lng?: number | null
          driver_id?: string | null
          eta_minutes?: number | null
          gerant_id?: string | null
          id?: string
          origin_address?: string
          origin_lat?: number | null
          origin_lng?: number | null
          reservation_id?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_circuits: {
        Row: {
          circuit_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          circuit_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          circuit_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_circuits_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      rides_gerant: {
        Row: {
          created_at: string | null
          created_by: string | null
          destination: string | null
          driver_id: string | null
          id: string | null
          notes: string | null
          pickup: string | null
          scheduled_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          destination?: string | null
          driver_id?: string | null
          id?: string | null
          notes?: string | null
          pickup?: string | null
          scheduled_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          destination?: string | null
          driver_id?: string | null
          id?: string | null
          notes?: string | null
          pickup?: string | null
          scheduled_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_ride: {
        Args: { _ride_id: string }
        Returns: {
          created_at: string
          created_by: string
          destination: string
          driver_id: string | null
          id: string
          notes: string | null
          pickup: string
          price: number
          scheduled_at: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "rides"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_ride: {
        Args: { _ride_id: string }
        Returns: {
          created_at: string
          created_by: string
          destination: string
          driver_id: string | null
          id: string
          notes: string | null
          pickup: string
          price: number
          scheduled_at: string | null
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "rides"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      gerant_has_circuit: {
        Args: { _circuit_id: string; _user_id: string }
        Returns: boolean
      }
      gerant_has_circuit_named: {
        Args: { _name: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "gerant" | "chauffeur" | "client"
      payment_status: "PENDING" | "VALIDATED" | "REJECTED"
      reservation_status:
        | "PENDING_PAYMENT"
        | "CONFIRMED"
        | "REJECTED"
        | "CANCELLED"
      service_type:
        | "TRANSPORT_SCOLAIRE"
        | "LOCATION_BUS"
        | "CIRCUIT_TOURISTIQUE"
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
      app_role: ["admin", "user", "gerant", "chauffeur", "client"],
      payment_status: ["PENDING", "VALIDATED", "REJECTED"],
      reservation_status: [
        "PENDING_PAYMENT",
        "CONFIRMED",
        "REJECTED",
        "CANCELLED",
      ],
      service_type: [
        "TRANSPORT_SCOLAIRE",
        "LOCATION_BUS",
        "CIRCUIT_TOURISTIQUE",
      ],
    },
  },
} as const
