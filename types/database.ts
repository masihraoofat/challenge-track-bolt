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
          scoring_mode: string;
          unit_label: string | null;
          description: string | null;
          icon: string;
          color: string;
          join_code: string;
        };
        Insert: {
          id?: string;
          title: string;
          start_date: string;
          end_date: string;
          creator_id: string;
          created_at?: string;
          scoring_mode?: string;
          unit_label?: string | null;
          description?: string | null;
          icon?: string;
          color?: string;
          join_code?: string;
        };
        Update: {
          id?: string;
          title?: string;
          start_date?: string;
          end_date?: string;
          creator_id?: string;
          created_at?: string;
          scoring_mode?: string;
          unit_label?: string | null;
          description?: string | null;
          icon?: string;
          color?: string;
          join_code?: string;
        };
      };
      participants: {
        Row: {
          competition_id: string;
          user_id: string;
          score: number | string;
          joined_at: string;
          left_at: string | null;
        };
        Insert: {
          competition_id: string;
          user_id: string;
          score?: number | string;
          joined_at?: string;
          left_at?: string | null;
        };
        Update: {
          competition_id?: string;
          user_id?: string;
          score?: number | string;
          joined_at?: string;
          left_at?: string | null;
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
          value: number | string | null;
        };
        Insert: {
          id?: string;
          competition_id: string;
          user_id: string;
          date_logged: string;
          completed?: boolean;
          created_at?: string;
          value?: number | string | null;
        };
        Update: {
          id?: string;
          competition_id?: string;
          user_id?: string;
          date_logged?: string;
          completed?: boolean;
          created_at?: string;
          value?: number | string | null;
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
      goals: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          goal_type: string;
          icon: string;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          goal_type?: string;
          icon?: string;
          color?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          goal_type?: string;
          icon?: string;
          color?: string;
          created_at?: string;
        };
      };
      goal_logs: {
        Row: {
          id: string;
          goal_id: string;
          user_id: string;
          date_logged: string;
          completed: boolean;
          value: number | string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          goal_id: string;
          user_id: string;
          date_logged?: string;
          completed?: boolean;
          value?: number | string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          goal_id?: string;
          user_id?: string;
          date_logged?: string;
          completed?: boolean;
          value?: number | string | null;
          created_at?: string;
        };
      };
    };
    Functions: {
      increment_score: {
        Args: {
          comp_id: string;
          uid: string;
          amount?: number | string;
        };
        Returns: undefined;
      };
      delete_competition: {
        Args: {
          comp_id: string;
        };
        Returns: undefined;
      };
      join_competition: {
        Args: {
          comp_id: string;
        };
        Returns: undefined;
      };
      leave_competition: {
        Args: {
          comp_id: string;
        };
        Returns: undefined;
      };
    };
  };
}
