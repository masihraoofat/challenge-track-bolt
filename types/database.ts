export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          username: string;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          created_at?: string;
        };
      };
      competitions: {
        Row: {
          id: string;
          title: string;
          start_date: string;
          end_date: string;
          creator_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          start_date: string;
          end_date: string;
          creator_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          start_date?: string;
          end_date?: string;
          creator_id?: string;
          created_at?: string;
        };
      };
      participants: {
        Row: {
          competition_id: string;
          user_id: string;
          score: number;
          joined_at: string;
        };
        Insert: {
          competition_id: string;
          user_id: string;
          score?: number;
          joined_at?: string;
        };
        Update: {
          competition_id?: string;
          user_id?: string;
          score?: number;
          joined_at?: string;
        };
      };
      daily_logs: {
        Row: {
          id: string;
          competition_id: string;
          user_id: string;
          date_logged: string;
          completed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          competition_id: string;
          user_id: string;
          date_logged: string;
          completed?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          competition_id?: string;
          user_id?: string;
          date_logged?: string;
          completed?: boolean;
          created_at?: string;
        };
      };
      analytics_events: {
        Row: {
          id: string;
          user_id: string;
          event_type: string;
          event_data: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          event_type: string;
          event_data?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          event_type?: string;
          event_data?: Json;
          created_at?: string;
        };
      };
    };
  };
}
