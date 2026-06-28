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
          bio: string | null;
          avatar_url: string | null;
          challenges_won: number;
          created_at: string;
        };
        Insert: {
          id: string;
          username: string;
          bio?: string | null;
          avatar_url?: string | null;
          challenges_won?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          bio?: string | null;
          avatar_url?: string | null;
          challenges_won?: number;
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
          score_limit: number | null;
          winner_id: string | null;
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
          score_limit?: number | null;
          winner_id?: string | null;
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
          score_limit?: number | null;
          winner_id?: string | null;
        };
      };
      participants: {
        Row: {
          competition_id: string;
          user_id: string;
          score: number | string;
          joined_at: string;
          left_at: string | null;
          results_viewed_at: string | null;
        };
        Insert: {
          competition_id: string;
          user_id: string;
          score?: number | string;
          joined_at?: string;
          left_at?: string | null;
          results_viewed_at?: string | null;
        };
        Update: {
          competition_id?: string;
          user_id?: string;
          score?: number | string;
          joined_at?: string;
          left_at?: string | null;
          results_viewed_at?: string | null;
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
      friendships: {
        Row: {
          requester_id: string;
          addressee_id: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          requester_id: string;
          addressee_id: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          requester_id?: string;
          addressee_id?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      competition_invitations: {
        Row: {
          id: string;
          competition_id: string;
          inviter_id: string;
          invitee_id: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          competition_id: string;
          inviter_id: string;
          invitee_id: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          competition_id?: string;
          inviter_id?: string;
          invitee_id?: string;
          status?: string;
          created_at?: string;
        };
      };
      collaborations: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          creator_id: string;
          start_date: string;
          end_date: string | null;
          unit_label: string | null;
          icon: string;
          color: string;
          join_code: string;
          goal_mode: string;
          overall_target_value: number | string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          creator_id: string;
          start_date: string;
          end_date?: string | null;
          unit_label?: string | null;
          icon?: string;
          color?: string;
          join_code?: string;
          goal_mode?: string;
          overall_target_value?: number | string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          creator_id?: string;
          start_date?: string;
          end_date?: string | null;
          unit_label?: string | null;
          icon?: string;
          color?: string;
          join_code?: string;
          goal_mode?: string;
          overall_target_value?: number | string | null;
          created_at?: string;
        };
      };
      collaboration_goal_periods: {
        Row: {
          id: string;
          collaboration_id: string;
          period_type: string;
          target_value: number | string | null;
        };
        Insert: {
          id?: string;
          collaboration_id: string;
          period_type: string;
          target_value?: number | string | null;
        };
        Update: {
          id?: string;
          collaboration_id?: string;
          period_type?: string;
          target_value?: number | string | null;
        };
      };
      collaboration_members: {
        Row: {
          collaboration_id: string;
          user_id: string;
          joined_at: string;
          left_at: string | null;
        };
        Insert: {
          collaboration_id: string;
          user_id: string;
          joined_at?: string;
          left_at?: string | null;
        };
        Update: {
          collaboration_id?: string;
          user_id?: string;
          joined_at?: string;
          left_at?: string | null;
        };
      };
      collaboration_logs: {
        Row: {
          id: string;
          collaboration_id: string;
          user_id: string;
          date_logged: string;
          completed: boolean;
          value: number | string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          collaboration_id: string;
          user_id: string;
          date_logged: string;
          completed?: boolean;
          value?: number | string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          collaboration_id?: string;
          user_id?: string;
          date_logged?: string;
          completed?: boolean;
          value?: number | string | null;
          created_at?: string;
        };
      };
      collaboration_invitations: {
        Row: {
          id: string;
          collaboration_id: string;
          inviter_id: string;
          invitee_id: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          collaboration_id: string;
          inviter_id: string;
          invitee_id: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          collaboration_id?: string;
          inviter_id?: string;
          invitee_id?: string;
          status?: string;
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
      finalize_competition: {
        Args: {
          comp_id: string;
        };
        Returns: string | null;
      };
      mark_competition_results_viewed: {
        Args: {
          comp_id: string;
        };
        Returns: undefined;
      };
      send_friend_request: {
        Args: {
          target_id: string;
        };
        Returns: undefined;
      };
      accept_friend_request: {
        Args: {
          requester_id: string;
        };
        Returns: undefined;
      };
      decline_friend_request: {
        Args: {
          requester_id: string;
        };
        Returns: undefined;
      };
      cancel_friend_request: {
        Args: {
          addressee_id: string;
        };
        Returns: undefined;
      };
      remove_friend: {
        Args: {
          friend_id: string;
        };
        Returns: undefined;
      };
      invite_friend_to_competition: {
        Args: {
          comp_id: string;
          friend_id: string;
        };
        Returns: undefined;
      };
      respond_competition_invitation: {
        Args: {
          invitation_id: string;
          accept: boolean;
        };
        Returns: undefined;
      };
      join_collaboration: {
        Args: {
          collab_id: string;
        };
        Returns: undefined;
      };
      leave_collaboration: {
        Args: {
          collab_id: string;
        };
        Returns: undefined;
      };
      delete_collaboration: {
        Args: {
          collab_id: string;
        };
        Returns: undefined;
      };
      invite_friend_to_collaboration: {
        Args: {
          collab_id: string;
          friend_id: string;
        };
        Returns: undefined;
      };
      respond_collaboration_invitation: {
        Args: {
          invitation_id: string;
          accept: boolean;
        };
        Returns: undefined;
      };
    };
  };
}
