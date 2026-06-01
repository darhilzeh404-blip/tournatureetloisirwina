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
      drivers: {
        Row: {
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
          created_at: string
          description: string
          email: string | null
          id: string
          is_active: boolean
          is_verified: boolean
          logo_url: string | null
          name: string
          owner_user_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_verified?: boolean
          logo_url?: string | null
          name: string
          owner_user_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_verified?: boolean
          logo_url?: string | null
          name?: string
          owner_user_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      partner_tickets: {
        Row: {
          agency_id: string
          category_id: string
          created_at: string
          departure_at: string | null
          description: string
          destination: string | null
          id: string
          image_url: string | null
          is_active: boolean
          origin: string | null
          price: number
          seats_available: number
          title: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          category_id: string
          created_at?: string
          departure_at?: string | null
          description?: string
          destination?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          origin?: string | null
          price?: number
          seats_available?: number
          title: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          category_id?: string
          created_at?: string
          departure_at?: string | null
          description?: string
          destination?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          origin?: string | null
          price?: number
          seats_available?: number
          title?: string
          updated_at?: string
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
          archived_at: string | null
          coins_awarded: boolean
          coins_used: number
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
          coins_awarded?: boolean
          coins_used?: number
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
          coins_awarded?: boolean
          coins_used?: number
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
      vehicle_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
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
          id?: string
          level_name?: string
          min_coins?: number
          sort_order?: number
          updated_at?: string
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
      accept_vtc_trip: {
        Args: { _trip_id: string }
        Returns: {
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
      find_nearby_vtc_drivers: {
        Args: { _pickup_lat: number; _pickup_lng: number; _radius_km?: number }
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
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
      recompute_vip_level: { Args: { _user_id: string }; Returns: string }
      refund_wina_coins: {
        Args: { _reservation_id: string }
        Returns: undefined
      }
      refund_wina_coins_group_payment: {
        Args: { _payment_id: string }
        Returns: undefined
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
    }
    Enums: {
      app_role: "admin" | "user" | "gerant" | "chauffeur" | "client" | "agence"
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
      app_role: ["admin", "user", "gerant", "chauffeur", "client", "agence"],
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
      ],
    },
  },
} as const
