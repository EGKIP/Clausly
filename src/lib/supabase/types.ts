export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          default_state: string | null;
          subscription_tier: "free" | "pro";
          notification_preferences: Json;
          onboarded_at: string | null;
          onboarding_tour_completed_at: string | null;
          weekly_digest_sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          default_state?: string | null;
          subscription_tier?: "free" | "pro";
          notification_preferences?: Json;
          onboarded_at?: string | null;
          onboarding_tour_completed_at?: string | null;
          weekly_digest_sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
      billing_customers: {
        Row: {
          user_id: string;
          stripe_customer_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          stripe_customer_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["billing_customers"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "billing_customers_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      qa_conversations: {
        Row: {
          id: string;
          user_id: string;
          document_id: string | null;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          document_id?: string | null;
          title: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["qa_conversations"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "qa_conversations_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      qa_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          citations: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: "user" | "assistant";
          content: string;
          citations?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["qa_messages"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "qa_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "qa_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      document_suggestions: {
        Row: {
          document_id: string;
          suggestions: Json;
          generated_at: string;
        };
        Insert: {
          document_id: string;
          suggestions?: Json;
          generated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["document_suggestions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "document_suggestions_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: true;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      portfolio_suggestions: {
        Row: {
          user_id: string;
          suggestions: Json;
          document_count: number;
          generated_at: string;
        };
        Insert: {
          user_id: string;
          suggestions?: Json;
          document_count?: number;
          generated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["portfolio_suggestions"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "portfolio_suggestions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      documents: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          party: string | null;
          document_type: Database["public"]["Enums"]["document_type"];
          jurisdiction: string | null;
          page_count: number;
          storage_path: string;
          file_name: string;
          mime_type: string;
          file_size_bytes: number;
          status: Database["public"]["Enums"]["document_status"];
          risk_level: Database["public"]["Enums"]["risk_level"] | null;
          monthly_value: number | null;
          effective_date: string | null;
          end_date: string | null;
          notice_window_days: number | null;
          summary_short: string | null;
          summary: string | null;
          tags: string[];
          error_message: string | null;
          analysis_started_at: string | null;
          analysis_attempts: number;
          failure_category: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          party?: string | null;
          document_type?: Database["public"]["Enums"]["document_type"];
          jurisdiction?: string | null;
          page_count?: number;
          storage_path: string;
          file_name: string;
          mime_type?: string;
          file_size_bytes?: number;
          status?: Database["public"]["Enums"]["document_status"];
          risk_level?: Database["public"]["Enums"]["risk_level"] | null;
          monthly_value?: number | null;
          effective_date?: string | null;
          end_date?: string | null;
          notice_window_days?: number | null;
          summary_short?: string | null;
          summary?: string | null;
          tags?: string[];
          error_message?: string | null;
          analysis_started_at?: string | null;
          analysis_attempts?: number;
          failure_category?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["documents"]["Insert"]>;
        Relationships: [];
      };
      clauses: {
        Row: {
          id: string;
          user_id: string;
          document_id: string;
          title: string;
          category: string;
          risk_level: Database["public"]["Enums"]["risk_level"];
          page_number: number;
          source_quote: string;
          plain_english: string;
          why_it_matters: string | null;
          confidence: number | null;
          bbox: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          document_id: string;
          title: string;
          category: string;
          risk_level?: Database["public"]["Enums"]["risk_level"];
          page_number?: number;
          source_quote: string;
          plain_english: string;
          why_it_matters?: string | null;
          confidence?: number | null;
          bbox?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["clauses"]["Insert"]>;
        Relationships: [];
      };
      dates: {
        Row: {
          id: string;
          user_id: string;
          document_id: string;
          clause_id: string | null;
          label: string;
          date_value: string;
          kind: Database["public"]["Enums"]["date_kind"];
          description: string | null;
          source_quote: string | null;
          confidence: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          document_id: string;
          clause_id?: string | null;
          label: string;
          date_value: string;
          kind?: Database["public"]["Enums"]["date_kind"];
          description?: string | null;
          source_quote?: string | null;
          confidence?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["dates"]["Insert"]>;
        Relationships: [];
      };
      reminders: {
        Row: {
          id: string;
          user_id: string;
          document_id: string;
          date_id: string | null;
          title: string;
          description: string;
          fire_on: string;
          reminder_time: string | null;
          status: Database["public"]["Enums"]["reminder_status"];
          channel: Database["public"]["Enums"]["reminder_channel"];
          reminder_type: string;
          source_quote: string | null;
          confidence: number | null;
          sent_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          document_id: string;
          date_id?: string | null;
          title: string;
          description: string;
          fire_on: string;
          reminder_time?: string | null;
          status?: Database["public"]["Enums"]["reminder_status"];
          channel?: Database["public"]["Enums"]["reminder_channel"];
          reminder_type?: string;
          source_quote?: string | null;
          confidence?: number | null;
          sent_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["reminders"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "reminders_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      document_chunks: {
        Row: {
          id: string;
          document_id: string;
          user_id: string;
          chunk_index: number;
          content: string;
          page_number: number | null;
          embedding: number[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          user_id: string;
          chunk_index: number;
          content: string;
          page_number?: number | null;
          embedding?: number[] | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["document_chunks"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
        ];
      };
      usage_metrics: {
        Row: {
          id: string;
          user_id: string;
          document_id: string | null;
          job_type: string;
          provider: string | null;
          model: string | null;
          input_token_count: number;
          output_token_count: number;
          status: "completed" | "failed";
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          document_id?: string | null;
          job_type: string;
          provider?: string | null;
          model?: string | null;
          input_token_count?: number;
          output_token_count?: number;
          status?: "completed" | "failed";
          error_message?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["usage_metrics"]["Insert"]>;
        Relationships: [];
      };
      document_exports: {
        Row: {
          id: string;
          user_id: string;
          document_id: string;
          format: "pdf" | "csv";
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          document_id: string;
          format: "pdf" | "csv";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["document_exports"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "document_exports_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_exports_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      document_shares: {
        Row: {
          id: string;
          document_id: string;
          user_id: string;
          token: string;
          expires_at: string | null;
          revoked_at: string | null;
          view_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          user_id: string;
          token: string;
          expires_at?: string | null;
          revoked_at?: string | null;
          view_count?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["document_shares"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "document_shares_document_id_fkey";
            columns: ["document_id"];
            isOneToOne: false;
            referencedRelation: "documents";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "document_shares_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_events: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          resource_type: string;
          resource_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          action: string;
          resource_type: string;
          resource_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_events"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "audit_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      weekly_digests: {
        Row: {
          id: string;
          user_id: string;
          sent_at: string;
          deadline_count: number;
          upload_count: number;
          high_risk_count: number;
          status: "sent" | "failed" | "skipped";
          error_message: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          sent_at?: string;
          deadline_count?: number;
          upload_count?: number;
          high_risk_count?: number;
          status?: "sent" | "failed" | "skipped";
          error_message?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["weekly_digests"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "weekly_digests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      delete_account: {
        Args: { target_user_id: string };
        Returns: void;
      };
      match_document_chunks: {
        Args: {
          target_document_id: string;
          query_embedding: number[];
          match_count?: number;
        };
        Returns: Array<{
          id: string;
          document_id: string;
          user_id: string;
          chunk_index: number;
          content: string;
          page_number: number | null;
          similarity: number;
        }>;
      };
      match_portfolio_chunks: {
        Args: {
          query_embedding: number[];
          match_count?: number;
          per_doc_cap?: number;
        };
        Returns: Array<{
          id: string;
          document_id: string;
          user_id: string;
          chunk_index: number;
          content: string;
          page_number: number | null;
          similarity: number;
        }>;
      };
    };
    Enums: {
      document_type: "lease" | "auto" | "employment" | "service" | "nda" | "other";
      document_status: "pending" | "analyzing" | "ready" | "failed";
      risk_level: "low" | "medium" | "high" | "needs_review";
      reminder_status: "suggested" | "approved" | "sent" | "ignored";
      reminder_channel: "email";
      date_kind: "deadline" | "renewal" | "notice" | "payment" | "effective" | "end" | "review";
    };
    CompositeTypes: Record<string, never>;
  };
};
