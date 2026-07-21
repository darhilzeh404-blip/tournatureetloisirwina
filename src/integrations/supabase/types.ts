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
      agency_notifications: {
        Row: {
          agency_id: string
          booking_id: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          payload: Json
          read_at: string | null
          title: string
          type: string
        }
        Insert: {
          agency_id: string
          booking_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          payload?: Json
          read_at?: string | null
          title: string
          type: string
        }
        Update: {
          agency_id?: string
          booking_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          payload?: Json
          read_at?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_notifications_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "partner_agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_notifications_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "partner_agencies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "partner_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          created_at: string
          description: string
          details_url: string | null
          ends_at: string
          id: string
          is_active: boolean
          starts_at: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          details_url?: string | null
          ends_at: string
          id?: string
          is_active?: boolean
          starts_at?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          details_url?: string | null
          ends_at?: string
          id?: string
          is_active?: boolean
          starts_at?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      application_fees: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          description: string | null
          fee_type: string
          id: string
          is_active: boolean
          name: string
          service_type: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          fee_type: string
          id?: string
          is_active?: boolean
          name: string
          service_type?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          fee_type?: string
          id?: string
          is_active?: boolean
          name?: string
          service_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          agency_id: string | null
          created_at: string
          id: string
          payload: Json
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          agency_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          agency_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "partner_agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "partner_agencies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_status_history: {
        Row: {
          actor_id: string | null
          booking_id: string
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          booking_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status: string
        }
        Update: {
          actor_id?: string | null
          booking_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_status_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "partner_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
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
      catalog_vehicle_categories: {
        Row: {
          created_at: string
          description: string | null
          icon_url: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      catalog_vehicles: {
        Row: {
          brand: string | null
          category_id: string
          created_at: string
          daily_rate: number | null
          description: string | null
          gallery: Json
          id: string
          is_active: boolean
          model: string | null
          name: string
          seats: number | null
          sort_order: number
          updated_at: string
          year: number | null
        }
        Insert: {
          brand?: string | null
          category_id: string
          created_at?: string
          daily_rate?: number | null
          description?: string | null
          gallery?: Json
          id?: string
          is_active?: boolean
          model?: string | null
          name: string
          seats?: number | null
          sort_order?: number
          updated_at?: string
          year?: number | null
        }
        Update: {
          brand?: string | null
          category_id?: string
          created_at?: string
          daily_rate?: number | null
          description?: string | null
          gallery?: Json
          id?: string
          is_active?: boolean
          model?: string | null
          name?: string
          seats?: number | null
          sort_order?: number
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_vehicles_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "catalog_vehicle_categories"
            referencedColumns: ["id"]
          },
        ]
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
          location: string
          lodging_price: number
          nom: string
          rating: number
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
          location?: string
          lodging_price?: number
          nom: string
          rating?: number
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
          location?: string
          lodging_price?: number
          nom?: string
          rating?: number
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      client_error_logs: {
        Row: {
          component_stack: string | null
          created_at: string
          fingerprint: string
          first_seen_at: string
          id: string
          last_seen_at: string
          message: string
          occurrences: number
          resolved: boolean
          role: string | null
          scope: string
          source: string
          stack: string | null
          url: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          component_stack?: string | null
          created_at?: string
          fingerprint: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          message: string
          occurrences?: number
          resolved?: boolean
          role?: string | null
          scope?: string
          source?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          component_stack?: string | null
          created_at?: string
          fingerprint?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          message?: string
          occurrences?: number
          resolved?: boolean
          role?: string | null
          scope?: string
          source?: string
          stack?: string | null
          url?: string | null
          user_agent?: string | null
          user_id?: string | null
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
      driver_availability: {
        Row: {
          driver_id: string
          is_online: boolean
          last_seen_at: string
          updated_at: string
        }
        Insert: {
          driver_id: string
          is_online?: boolean
          last_seen_at?: string
          updated_at?: string
        }
        Update: {
          driver_id?: string
          is_online?: boolean
          last_seen_at?: string
          updated_at?: string
        }
        Relationships: []
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
      driver_wallet_transactions: {
        Row: {
          created_at: string
          driver_id: string
          gross_amount: number
          id: string
          net_amount: number
          note: string | null
          payment_method: string
          platform_fee: number
          reservation_id: string | null
          status: string
          trip_id: string | null
        }
        Insert: {
          created_at?: string
          driver_id: string
          gross_amount: number
          id?: string
          net_amount: number
          note?: string | null
          payment_method: string
          platform_fee: number
          reservation_id?: string | null
          status?: string
          trip_id?: string | null
        }
        Update: {
          created_at?: string
          driver_id?: string
          gross_amount?: number
          id?: string
          net_amount?: number
          note?: string | null
          payment_method?: string
          platform_fee?: number
          reservation_id?: string | null
          status?: string
          trip_id?: string | null
        }
        Relationships: []
      }
      driver_wallets: {
        Row: {
          balance_earnings: number
          created_at: string
          driver_id: string
          total_commission_paid: number
          total_earned: number
          updated_at: string
        }
        Insert: {
          balance_earnings?: number
          created_at?: string
          driver_id: string
          total_commission_paid?: number
          total_earned?: number
          updated_at?: string
        }
        Update: {
          balance_earnings?: number
          created_at?: string
          driver_id?: string
          total_commission_paid?: number
          total_earned?: number
          updated_at?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          category: Database["public"]["Enums"]["vtc_category"]
          created_at: string
          email: string | null
          full_name: string
          id: string
          license_plate: string
          phone: string | null
          status: string
          updated_at: string
          user_id: string
          vehicle_type: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["vtc_category"]
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          license_plate?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id: string
          vehicle_type?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["vtc_category"]
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          license_plate?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          vehicle_type?: string
        }
        Relationships: []
      }
      event_bus_capacity_factors: {
        Row: {
          capacity: number
          created_at: string
          factor: number
          id: string
          updated_at: string
        }
        Insert: {
          capacity: number
          created_at?: string
          factor: number
          id?: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          created_at?: string
          factor?: number
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_bus_tariffs: {
        Row: {
          amount: number
          created_at: string
          formule: string
          id: string
          standing: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          formule: string
          id?: string
          standing: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          formule?: string
          id?: string
          standing?: string
          updated_at?: string
        }
        Relationships: []
      }
      extra_activities: {
        Row: {
          code: string
          created_at: string
          emoji: string | null
          id: string
          is_active: boolean
          label: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          emoji?: string | null
          id?: string
          is_active?: boolean
          label: string
          price: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          emoji?: string | null
          id?: string
          is_active?: boolean
          label?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      group_bus_trips: {
        Row: {
          code: string
          created_at: string
          destinations: string[]
          gathering: string
          id: string
          is_active: boolean
          note: string | null
          pricing: Json
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          destinations?: string[]
          gathering: string
          id?: string
          is_active?: boolean
          note?: string | null
          pricing: Json
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          destinations?: string[]
          gathering?: string
          id?: string
          is_active?: boolean
          note?: string | null
          pricing?: Json
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      group_ride_passengers: {
        Row: {
          commune_destination: string
          commune_pickup: string
          destination_address: string
          destination_lat: number
          destination_lng: number
          id: string
          joined_at: string
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          ride_id: string
          seat_index: number
          status: string
          user_id: string
        }
        Insert: {
          commune_destination: string
          commune_pickup: string
          destination_address: string
          destination_lat: number
          destination_lng: number
          id?: string
          joined_at?: string
          pickup_address: string
          pickup_lat: number
          pickup_lng: number
          ride_id: string
          seat_index: number
          status?: string
          user_id: string
        }
        Update: {
          commune_destination?: string
          commune_pickup?: string
          destination_address?: string
          destination_lat?: number
          destination_lng?: number
          id?: string
          joined_at?: string
          pickup_address?: string
          pickup_lat?: number
          pickup_lng?: number
          ride_id?: string
          seat_index?: number
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_ride_passengers_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "group_rides"
            referencedColumns: ["id"]
          },
        ]
      }
      group_ride_payments: {
        Row: {
          admin_comment: string | null
          amount: number
          coins_awarded: boolean
          created_at: string
          id: string
          method: string
          passenger_id: string
          receipt_url: string | null
          ride_id: string
          status: string
          transaction_ref: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_comment?: string | null
          amount: number
          coins_awarded?: boolean
          created_at?: string
          id?: string
          method?: string
          passenger_id: string
          receipt_url?: string | null
          ride_id: string
          status?: string
          transaction_ref?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_comment?: string | null
          amount?: number
          coins_awarded?: boolean
          created_at?: string
          id?: string
          method?: string
          passenger_id?: string
          receipt_url?: string | null
          ride_id?: string
          status?: string
          transaction_ref?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_ride_payments_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "group_ride_passengers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_ride_payments_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "group_rides"
            referencedColumns: ["id"]
          },
        ]
      }
      group_ride_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          new_status: string
          old_status: string | null
          ride_id: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status: string
          old_status?: string | null
          ride_id: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          new_status?: string
          old_status?: string | null
          ride_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_ride_status_history_ride_id_fkey"
            columns: ["ride_id"]
            isOneToOne: false
            referencedRelation: "group_rides"
            referencedColumns: ["id"]
          },
        ]
      }
      group_rides: {
        Row: {
          archived_at: string | null
          communes_count: number
          completed_at: string | null
          created_at: string
          departure_deadline: string
          driver_id: string | null
          id: string
          max_seats: number
          price_per_seat: number
          route_id: string | null
          seats_taken: number
          signature: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          communes_count?: number
          completed_at?: string | null
          created_at?: string
          departure_deadline?: string
          driver_id?: string | null
          id?: string
          max_seats?: number
          price_per_seat?: number
          route_id?: string | null
          seats_taken?: number
          signature?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          communes_count?: number
          completed_at?: string | null
          created_at?: string
          departure_deadline?: string
          driver_id?: string | null
          id?: string
          max_seats?: number
          price_per_seat?: number
          route_id?: string | null
          seats_taken?: number
          signature?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_rides_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "group_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      group_routes: {
        Row: {
          created_at: string
          destination_commune: string
          id: string
          is_active: boolean
          name: string
          origin_commune: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination_commune: string
          id?: string
          is_active?: boolean
          name: string
          origin_commune: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination_commune?: string
          id?: string
          is_active?: boolean
          name?: string
          origin_commune?: string
          updated_at?: string
        }
        Relationships: []
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
      partner_agencies: {
        Row: {
          category: Database["public"]["Enums"]["agency_category"] | null
          commission_percent: number
          created_at: string
          description: string
          email: string | null
          id: string
          is_active: boolean
          is_verified: boolean
          logo_url: string | null
          name: string
          owner_user_id: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["agency_category"] | null
          commission_percent?: number
          created_at?: string
          description?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_verified?: boolean
          logo_url?: string | null
          name: string
          owner_user_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["agency_category"] | null
          commission_percent?: number
          created_at?: string
          description?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_verified?: boolean
          logo_url?: string | null
          name?: string
          owner_user_id?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      partner_bookings: {
        Row: {
          agency_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          details: Json
          id: string
          passenger_email: string | null
          passenger_name: string
          passenger_phone: string | null
          reference_code: string | null
          seats: number
          status: string
          ticket_id: string | null
          total_amount: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          agency_id: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          details?: Json
          id?: string
          passenger_email?: string | null
          passenger_name: string
          passenger_phone?: string | null
          reference_code?: string | null
          seats?: number
          status?: string
          ticket_id?: string | null
          total_amount?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          agency_id?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          confirmed_at?: string | null
          created_at?: string
          details?: Json
          id?: string
          passenger_email?: string | null
          passenger_name?: string
          passenger_phone?: string | null
          reference_code?: string | null
          seats?: number
          status?: string
          ticket_id?: string | null
          total_amount?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_bookings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "partner_agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_bookings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "partner_agencies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_bookings_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "partner_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_commission_rates: {
        Row: {
          agency_id: string
          category: string
          commission_percent: number
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          category: string
          commission_percent?: number
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          category?: string
          commission_percent?: number
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_commission_rates_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "partner_agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_commission_rates_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "partner_agencies_public"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_ticket_codes: {
        Row: {
          agency_id: string
          booking_id: string
          code: string
          created_at: string
          id: string
          is_void: boolean
          issued_at: string
          issued_by: string | null
          qr_url: string
          seat_index: number
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          agency_id: string
          booking_id: string
          code: string
          created_at?: string
          id?: string
          is_void?: boolean
          issued_at?: string
          issued_by?: string | null
          qr_url: string
          seat_index?: number
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          agency_id?: string
          booking_id?: string
          code?: string
          created_at?: string
          id?: string
          is_void?: boolean
          issued_at?: string
          issued_by?: string | null
          qr_url?: string
          seat_index?: number
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_ticket_codes_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "partner_agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_ticket_codes_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "partner_agencies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_ticket_codes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "partner_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_tickets: {
        Row: {
          agency_id: string
          category_id: string | null
          created_at: string
          departure_at: string | null
          description: string
          destination: string | null
          id: string
          image_url: string | null
          is_active: boolean
          origin: string | null
          price: number
          return_departure_at: string | null
          return_destination: string | null
          return_origin: string | null
          seats_available: number
          seats_total: number | null
          title: string
          transport_mode: string | null
          updated_at: string
          vehicle_kind: string | null
        }
        Insert: {
          agency_id: string
          category_id?: string | null
          created_at?: string
          departure_at?: string | null
          description?: string
          destination?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          origin?: string | null
          price?: number
          return_departure_at?: string | null
          return_destination?: string | null
          return_origin?: string | null
          seats_available?: number
          seats_total?: number | null
          title: string
          transport_mode?: string | null
          updated_at?: string
          vehicle_kind?: string | null
        }
        Update: {
          agency_id?: string
          category_id?: string | null
          created_at?: string
          departure_at?: string | null
          description?: string
          destination?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          origin?: string | null
          price?: number
          return_departure_at?: string | null
          return_destination?: string | null
          return_origin?: string | null
          seats_available?: number
          seats_total?: number | null
          title?: string
          transport_mode?: string | null
          updated_at?: string
          vehicle_kind?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_tickets_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "partner_agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_tickets_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "partner_agencies_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_tickets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "ticket_categories"
            referencedColumns: ["id"]
          },
        ]
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
          agent_code: string | null
          archived_at: string | null
          coins_awarded: boolean
          coins_used: number
          created_at: string
          details: Json
          id: string
          paid_amount: number
          paiement_valide: boolean
          reference_code: string | null
          reservation_date: string
          service_type: Database["public"]["Enums"]["service_type"]
          status: Database["public"]["Enums"]["reservation_status"]
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_comment?: string | null
          agent_code?: string | null
          archived_at?: string | null
          coins_awarded?: boolean
          coins_used?: number
          created_at?: string
          details?: Json
          id?: string
          paid_amount?: number
          paiement_valide?: boolean
          reference_code?: string | null
          reservation_date: string
          service_type: Database["public"]["Enums"]["service_type"]
          status?: Database["public"]["Enums"]["reservation_status"]
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_comment?: string | null
          agent_code?: string | null
          archived_at?: string | null
          coins_awarded?: boolean
          coins_used?: number
          created_at?: string
          details?: Json
          id?: string
          paid_amount?: number
          paiement_valide?: boolean
          reference_code?: string | null
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
      school_monthly_tariffs: {
        Row: {
          amount: number
          created_at: string
          formule: string
          id: string
          standing: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          formule: string
          id?: string
          standing: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          formule?: string
          id?: string
          standing?: string
          updated_at?: string
        }
        Relationships: []
      }
      school_trip_tariffs: {
        Row: {
          amount: number
          created_at: string
          formule: string
          id: string
          route_label: string
          sort_order: number
          standing: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          formule: string
          id?: string
          route_label: string
          sort_order?: number
          standing: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          formule?: string
          id?: string
          route_label?: string
          sort_order?: number
          standing?: string
          updated_at?: string
        }
        Relationships: []
      }
      ticket_categories: {
        Row: {
          created_at: string
          icon: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          icon?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          icon?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      tickets: {
        Row: {
          conditions: string
          created_at: string
          description: string
          id: string
          images: string[]
          is_active: boolean
          price: number
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          conditions?: string
          created_at?: string
          description?: string
          id?: string
          images?: string[]
          is_active?: boolean
          price?: number
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          conditions?: string
          created_at?: string
          description?: string
          id?: string
          images?: string[]
          is_active?: boolean
          price?: number
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      tourist_sites: {
        Row: {
          created_at: string
          description: string
          id: string
          images: string[]
          is_active: boolean
          location: string | null
          name: string
          price: number
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          images?: string[]
          is_active?: boolean
          location?: string | null
          name: string
          price?: number
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          images?: string[]
          is_active?: boolean
          location?: string | null
          name?: string
          price?: number
          slug?: string
          sort_order?: number
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
          location: string
          name: string
          price: number
          rating: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          duration_hours?: number
          id?: string
          is_active?: boolean
          location?: string
          name: string
          price?: number
          rating?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          duration_hours?: number
          id?: string
          is_active?: boolean
          location?: string
          name?: string
          price?: number
          rating?: number
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
      transport_misc_settings: {
        Row: {
          created_at: string
          key: string
          label: string | null
          updated_at: string
          value_int: number
        }
        Insert: {
          created_at?: string
          key: string
          label?: string | null
          updated_at?: string
          value_int: number
        }
        Update: {
          created_at?: string
          key?: string
          label?: string | null
          updated_at?: string
          value_int?: number
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
          category: Database["public"]["Enums"]["vtc_category"] | null
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
          category?: Database["public"]["Enums"]["vtc_category"] | null
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
          category?: Database["public"]["Enums"]["vtc_category"] | null
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
      vehicle_types: {
        Row: {
          category: Database["public"]["Enums"]["vtc_category"]
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["vtc_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["vtc_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      vip_levels: {
        Row: {
          badge_icon: string
          benefits: Json
          bonus_percentage: number
          created_at: string
          description: string | null
          id: string
          level_name: string
          min_coins: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          badge_icon?: string
          benefits?: Json
          bonus_percentage?: number
          created_at?: string
          description?: string | null
          id?: string
          level_name: string
          min_coins?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          badge_icon?: string
          benefits?: Json
          bonus_percentage?: number
          created_at?: string
          description?: string | null
          id?: string
          level_name?: string
          min_coins?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      vtc_recharge_requests: {
        Row: {
          admin_note: string | null
          agent_code: string | null
          amount_fcfa: number
          amount_points: number
          client_note: string | null
          created_at: string
          id: string
          payment_method: Database["public"]["Enums"]["vtc_recharge_method"]
          payment_reference: string | null
          proof_url: string | null
          status: Database["public"]["Enums"]["vtc_recharge_status"]
          updated_at: string
          user_id: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          admin_note?: string | null
          agent_code?: string | null
          amount_fcfa: number
          amount_points: number
          client_note?: string | null
          created_at?: string
          id?: string
          payment_method: Database["public"]["Enums"]["vtc_recharge_method"]
          payment_reference?: string | null
          proof_url?: string | null
          status?: Database["public"]["Enums"]["vtc_recharge_status"]
          updated_at?: string
          user_id: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          admin_note?: string | null
          agent_code?: string | null
          amount_fcfa?: number
          amount_points?: number
          client_note?: string | null
          created_at?: string
          id?: string
          payment_method?: Database["public"]["Enums"]["vtc_recharge_method"]
          payment_reference?: string | null
          proof_url?: string | null
          status?: Database["public"]["Enums"]["vtc_recharge_status"]
          updated_at?: string
          user_id?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: []
      }
      vtc_wallet_transactions: {
        Row: {
          amount_points: number
          balance_after: number
          created_at: string
          id: string
          note: string | null
          reference_code: string | null
          related_id: string | null
          related_type: string | null
          type: Database["public"]["Enums"]["vtc_tx_type"]
          user_id: string
        }
        Insert: {
          amount_points: number
          balance_after: number
          created_at?: string
          id?: string
          note?: string | null
          reference_code?: string | null
          related_id?: string | null
          related_type?: string | null
          type: Database["public"]["Enums"]["vtc_tx_type"]
          user_id: string
        }
        Update: {
          amount_points?: number
          balance_after?: number
          created_at?: string
          id?: string
          note?: string | null
          reference_code?: string | null
          related_id?: string | null
          related_type?: string | null
          type?: Database["public"]["Enums"]["vtc_tx_type"]
          user_id?: string
        }
        Relationships: []
      }
      vtc_wallets: {
        Row: {
          balance_points: number
          created_at: string
          total_recharged: number
          total_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_points?: number
          created_at?: string
          total_recharged?: number
          total_spent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_points?: number
          created_at?: string
          total_recharged?: number
          total_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wina_coin_balances: {
        Row: {
          coins_balance: number
          total_coins_earned: number
          total_reservations: number
          updated_at: string
          user_id: string
          vip_level_id: string | null
        }
        Insert: {
          coins_balance?: number
          total_coins_earned?: number
          total_reservations?: number
          updated_at?: string
          user_id: string
          vip_level_id?: string | null
        }
        Update: {
          coins_balance?: number
          total_coins_earned?: number
          total_reservations?: number
          updated_at?: string
          user_id?: string
          vip_level_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wina_coin_balances_vip_level_id_fkey"
            columns: ["vip_level_id"]
            isOneToOne: false
            referencedRelation: "vip_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      wina_coins_history: {
        Row: {
          amount_paid: number
          bonus_percentage: number
          coins_earned: number
          created_at: string
          id: string
          note: string | null
          operation_type: string
          reservation_id: string | null
          reservation_type: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_paid?: number
          bonus_percentage?: number
          coins_earned?: number
          created_at?: string
          id?: string
          note?: string | null
          operation_type: string
          reservation_id?: string | null
          reservation_type?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          bonus_percentage?: number
          coins_earned?: number
          created_at?: string
          id?: string
          note?: string | null
          operation_type?: string
          reservation_id?: string | null
          reservation_type?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      wina_gift_redemptions: {
        Row: {
          admin_note: string | null
          coins_spent: number
          created_at: string
          gift_id: string
          id: string
          status: Database["public"]["Enums"]["gift_redemption_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          coins_spent: number
          created_at?: string
          gift_id: string
          id?: string
          status?: Database["public"]["Enums"]["gift_redemption_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          coins_spent?: number
          created_at?: string
          gift_id?: string
          id?: string
          status?: Database["public"]["Enums"]["gift_redemption_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wina_gift_redemptions_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: false
            referencedRelation: "wina_gifts"
            referencedColumns: ["id"]
          },
        ]
      }
      wina_gifts: {
        Row: {
          coins_cost: number
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          min_vip_level_id: string | null
          name: string
          sort_order: number
          stock: number | null
          updated_at: string
        }
        Insert: {
          coins_cost: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          min_vip_level_id?: string | null
          name: string
          sort_order?: number
          stock?: number | null
          updated_at?: string
        }
        Update: {
          coins_cost?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          min_vip_level_id?: string | null
          name?: string
          sort_order?: number
          stock?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wina_gifts_min_vip_level_id_fkey"
            columns: ["min_vip_level_id"]
            isOneToOne: false
            referencedRelation: "vip_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      wina_lotteries: {
        Row: {
          created_at: string
          description: string | null
          draw_date: string
          entry_cost_coins: number
          id: string
          image_url: string | null
          max_entries_per_user: number
          min_vip_level_id: string | null
          name: string
          prize_label: string
          status: Database["public"]["Enums"]["lottery_status"]
          updated_at: string
          winner_drawn_at: string | null
          winner_user_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          draw_date: string
          entry_cost_coins?: number
          id?: string
          image_url?: string | null
          max_entries_per_user?: number
          min_vip_level_id?: string | null
          name: string
          prize_label: string
          status?: Database["public"]["Enums"]["lottery_status"]
          updated_at?: string
          winner_drawn_at?: string | null
          winner_user_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          draw_date?: string
          entry_cost_coins?: number
          id?: string
          image_url?: string | null
          max_entries_per_user?: number
          min_vip_level_id?: string | null
          name?: string
          prize_label?: string
          status?: Database["public"]["Enums"]["lottery_status"]
          updated_at?: string
          winner_drawn_at?: string | null
          winner_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wina_lotteries_min_vip_level_id_fkey"
            columns: ["min_vip_level_id"]
            isOneToOne: false
            referencedRelation: "vip_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      wina_lottery_entries: {
        Row: {
          coins_spent: number
          created_at: string
          id: string
          lottery_id: string
          user_id: string
        }
        Insert: {
          coins_spent?: number
          created_at?: string
          id?: string
          lottery_id: string
          user_id: string
        }
        Update: {
          coins_spent?: number
          created_at?: string
          id?: string
          lottery_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wina_lottery_entries_lottery_id_fkey"
            columns: ["lottery_id"]
            isOneToOne: false
            referencedRelation: "wina_lotteries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      partner_agencies_public: {
        Row: {
          category: Database["public"]["Enums"]["agency_category"] | null
          description: string | null
          email: string | null
          id: string | null
          is_active: boolean | null
          is_verified: boolean | null
          logo_url: string | null
          name: string | null
          phone: string | null
        }
        Insert: {
          category?: Database["public"]["Enums"]["agency_category"] | null
          description?: string | null
          email?: never
          id?: string | null
          is_active?: boolean | null
          is_verified?: boolean | null
          logo_url?: string | null
          name?: string | null
          phone?: never
        }
        Update: {
          category?: Database["public"]["Enums"]["agency_category"] | null
          description?: string | null
          email?: never
          id?: string | null
          is_active?: boolean | null
          is_verified?: boolean | null
          logo_url?: string | null
          name?: string | null
          phone?: never
        }
        Relationships: []
      }
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
      accept_vtc_trip: {
        Args: { _trip_id: string }
        Returns: {
          archived_at: string | null
          category: Database["public"]["Enums"]["vtc_category"] | null
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
        SetofOptions: {
          from: "*"
          to: "trips"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_adjust_coins: {
        Args: { _delta: number; _note: string; _user_id: string }
        Returns: number
      }
      admin_adjust_vtc_wallet: {
        Args: { _delta: number; _note: string; _user_id: string }
        Returns: number
      }
      admin_credit_driver_earnings: {
        Args: {
          _driver_id: string
          _gross_amount: number
          _payment_method?: string
          _reservation_id: string
          _trip_id: string
        }
        Returns: number
      }
      admin_draw_lottery: { Args: { _lottery_id: string }; Returns: string }
      admin_validate_vtc_recharge: {
        Args: { _approve: boolean; _note?: string; _request_id: string }
        Returns: number
      }
      agency_cancel_booking: {
        Args: { _booking_id: string; _reason: string }
        Returns: {
          agency_id: string
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          confirmed_at: string | null
          created_at: string
          details: Json
          id: string
          passenger_email: string | null
          passenger_name: string
          passenger_phone: string | null
          reference_code: string | null
          seats: number
          status: string
          ticket_id: string | null
          total_amount: number
          updated_at: string
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "partner_bookings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      agency_issue_tickets: {
        Args: { _booking_id: string; _public_base_url?: string }
        Returns: {
          agency_id: string
          booking_id: string
          code: string
          created_at: string
          id: string
          is_void: boolean
          issued_at: string
          issued_by: string | null
          qr_url: string
          seat_index: number
          validated_at: string | null
          validated_by: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "partner_ticket_codes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      agency_validate_ticket_code: {
        Args: { _code: string }
        Returns: {
          agency_id: string
          booking_id: string
          code: string
          departure_at: string
          destination: string
          is_void: boolean
          just_validated: boolean
          origin: string
          passenger_name: string
          passenger_phone: string
          seat_index: number
          status: string
          validated_at: string
        }[]
      }
      archive_trip_and_reservation: {
        Args: { _trip_id: string }
        Returns: undefined
      }
      award_wina_coins: {
        Args: { _reservation_id: string }
        Returns: {
          coins_earned: number
          new_balance: number
          vip_level_id: string
        }[]
      }
      award_wina_coins_group_payment: {
        Args: { _payment_id: string }
        Returns: {
          coins_earned: number
          new_balance: number
          vip_level_id: string
        }[]
      }
      can_chauffeur_view_vtc_reservation: {
        Args: { _reservation_id: string; _user_id: string }
        Returns: boolean
      }
      can_client_view_assigned_vtc_driver: {
        Args: { _client_id: string; _driver_id: string }
        Returns: boolean
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
      complete_vtc_trip: {
        Args: { _trip_id: string }
        Returns: {
          driver_balance: number
          driver_net: number
          paid_via_wallet: boolean
        }[]
      }
      credit_driver_earnings: {
        Args: {
          _driver_id: string
          _gross_amount: number
          _payment_method?: string
          _reservation_id: string
          _trip_id: string
        }
        Returns: number
      }
      enter_wina_lottery: {
        Args: { _lottery_id: string; _quantity?: number }
        Returns: number
      }
      find_nearby_vtc_drivers: {
        Args: {
          _category?: Database["public"]["Enums"]["vtc_category"]
          _pickup_lat: number
          _pickup_lng: number
          _radius_km?: number
        }
        Returns: {
          distance_km: number
          driver_id: string
          last_seen_at: string
          latitude: number
          longitude: number
        }[]
      }
      gerant_has_circuit: {
        Args: { _circuit_id: string; _user_id: string }
        Returns: boolean
      }
      gerant_has_circuit_named: {
        Args: { _name: string; _user_id: string }
        Returns: boolean
      }
      get_all_partner_agencies_admin: {
        Args: never
        Returns: {
          category: Database["public"]["Enums"]["agency_category"] | null
          commission_percent: number
          created_at: string
          description: string
          email: string | null
          id: string
          is_active: boolean
          is_verified: boolean
          logo_url: string | null
          name: string
          owner_user_id: string | null
          phone: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "partner_agencies"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_assigned_vtc_driver: {
        Args: { _trip_id: string }
        Returns: {
          full_name: string
          license_plate: string
          phone: string
          vehicle_type: string
        }[]
      }
      get_chauffeur_vtc_active_trips: {
        Args: never
        Returns: {
          archived_at: string
          client_id: string
          completed_at: string
          created_at: string
          destination_address: string
          destination_lat: number
          destination_lng: number
          driver_id: string
          eta_minutes: number
          id: string
          origin_address: string
          origin_lat: number
          origin_lng: number
          payment_mode: string
          reservation_date: string
          reservation_id: string
          reservation_total_amount: number
          started_at: string
          status: string
        }[]
      }
      get_chauffeur_vtc_completed_trips: {
        Args: { _limit?: number }
        Returns: {
          archived_at: string
          client_id: string
          completed_at: string
          created_at: string
          destination_address: string
          destination_lat: number
          destination_lng: number
          driver_id: string
          eta_minutes: number
          id: string
          origin_address: string
          origin_lat: number
          origin_lng: number
          payment_mode: string
          reservation_date: string
          reservation_id: string
          reservation_total_amount: number
          started_at: string
          status: string
        }[]
      }
      get_driver_vtc_earnings: {
        Args: { _driver_id: string }
        Returns: {
          amount: number
          completed_at: string
          payment_id: string
          reservation_id: string
          trip_id: string
          trip_status: string
          validated_at: string
        }[]
      }
      get_group_ride_co_passengers: {
        Args: { _ride_id: string }
        Returns: {
          commune_destination: string
          commune_pickup: string
          id: string
          joined_at: string
          seat_index: number
          status: string
        }[]
      }
      get_group_ride_passengers_for_driver: {
        Args: { _ride_id: string }
        Returns: {
          commune_destination: string
          commune_pickup: string
          id: string
          joined_at: string
          ride_id: string
          seat_index: number
          status: string
          user_id: string
        }[]
      }
      get_my_partner_agency: {
        Args: never
        Returns: {
          category: Database["public"]["Enums"]["agency_category"] | null
          commission_percent: number
          created_at: string
          description: string
          email: string | null
          id: string
          is_active: boolean
          is_verified: boolean
          logo_url: string | null
          name: string
          owner_user_id: string | null
          phone: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "partner_agencies"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_vtc_pending_pool: {
        Args: never
        Returns: {
          category: string
          created_at: string
          destination_address: string
          destination_lat: number
          destination_lng: number
          origin_address: string
          origin_lat: number
          origin_lng: number
          payment_mode: string
          reservation_date: string
          reservation_id: string
          total_amount: number
          trip_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_agency_owner: {
        Args: { _agency_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_ride_driver: {
        Args: { _ride_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_ride_passenger: {
        Args: { _ride_id: string; _user_id: string }
        Returns: boolean
      }
      is_vtc_reservation: {
        Args: { _reservation_id: string }
        Returns: boolean
      }
      join_group_ride: {
        Args: {
          _commune_destination: string
          _commune_pickup: string
          _communes_count: number
          _destination_address: string
          _destination_lat: number
          _destination_lng: number
          _max_seats: number
          _pickup_address: string
          _pickup_lat: number
          _pickup_lng: number
          _price_per_seat: number
          _signature: string
          _wait_minutes: number
        }
        Returns: {
          ride_id: string
          seat_index: number
        }[]
      }
      pay_reservation_with_wallet: {
        Args: { _reservation_id: string }
        Returns: {
          new_balance: number
          total_paid: number
        }[]
      }
      recompute_vip_level: { Args: { _user_id: string }; Returns: string }
      redeem_wina_gift: { Args: { _gift_id: string }; Returns: string }
      refund_vtc_points: {
        Args: {
          _amount: number
          _note: string
          _related_id: string
          _related_type: string
          _user_id: string
        }
        Returns: number
      }
      refund_wina_coins: {
        Args: { _reservation_id: string }
        Returns: undefined
      }
      refund_wina_coins_group_payment: {
        Args: { _payment_id: string }
        Returns: undefined
      }
      report_client_error: {
        Args: {
          _component_stack: string
          _fingerprint: string
          _message: string
          _role: string
          _scope: string
          _source: string
          _stack: string
          _url: string
          _user_agent: string
        }
        Returns: undefined
      }
      request_vtc_recharge: {
        Args: {
          _agent_code: string
          _amount_points: number
          _client_note?: string
          _payment_method: Database["public"]["Enums"]["vtc_recharge_method"]
          _payment_reference: string
          _proof_url?: string
        }
        Returns: string
      }
      spend_vtc_points: {
        Args: {
          _amount: number
          _note?: string
          _related_id: string
          _related_type: string
        }
        Returns: number
      }
      spend_wina_coins: {
        Args: { _amount: number; _reservation_id: string }
        Returns: number
      }
      trigger_driver_search: {
        Args: { _trip_id: string }
        Returns: {
          nearby_count: number
          status: string
        }[]
      }
      verify_ticket_code_public: {
        Args: { _code: string }
        Returns: {
          agency_logo: string
          agency_name: string
          code: string
          departure_at: string
          destination: string
          is_void: boolean
          origin: string
          passenger_name: string
          seat_index: number
          status: string
          validated_at: string
        }[]
      }
    }
    Enums: {
      agency_category: "bus" | "train" | "avion" | "bateau" | "evenement"
      app_role: "admin" | "user" | "gerant" | "chauffeur" | "client" | "agence"
      gift_redemption_status: "pending" | "delivered" | "cancelled"
      lottery_status: "draft" | "open" | "closed" | "drawn"
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
        | "VTC"
        | "BILLET"
        | "LOCATION_CATALOGUE"
      vtc_category: "STANDARD" | "CONFORT" | "VIP"
      vtc_recharge_method:
        | "mobile_money"
        | "cash_agent"
        | "bank_transfer"
        | "other"
        | "airtel_money"
        | "moov_money"
      vtc_recharge_status: "pending" | "approved" | "rejected"
      vtc_tx_type: "recharge" | "trip_payment" | "refund" | "admin_adjust"
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
      agency_category: ["bus", "train", "avion", "bateau", "evenement"],
      app_role: ["admin", "user", "gerant", "chauffeur", "client", "agence"],
      gift_redemption_status: ["pending", "delivered", "cancelled"],
      lottery_status: ["draft", "open", "closed", "drawn"],
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
        "VTC",
        "BILLET",
        "LOCATION_CATALOGUE",
      ],
      vtc_category: ["STANDARD", "CONFORT", "VIP"],
      vtc_recharge_method: [
        "mobile_money",
        "cash_agent",
        "bank_transfer",
        "other",
        "airtel_money",
        "moov_money",
      ],
      vtc_recharge_status: ["pending", "approved", "rejected"],
      vtc_tx_type: ["recharge", "trip_payment", "refund", "admin_adjust"],
    },
  },
} as const
