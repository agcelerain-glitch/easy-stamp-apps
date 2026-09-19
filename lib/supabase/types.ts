export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          nickname: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          nickname: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          nickname?: string;
          created_at?: string;
        };
      };
      stamps: {
        Row: {
          id: string;
          profile_id: string;
          stamp_point_id: number;
          stamped_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          stamp_point_id: number;
          stamped_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          stamp_point_id?: number;
          stamped_at?: string;
        };
      };
      otp_codes: {
        Row: {
          id: string;
          profile_id: string;
          stamp_point_id: number;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          stamp_point_id: number;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          stamp_point_id?: number;
          expires_at?: string;
          created_at?: string;
        };
      };
    };
  };
}
