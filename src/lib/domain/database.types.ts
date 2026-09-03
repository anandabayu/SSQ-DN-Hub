/**
 * Hand-written to match supabase/migrations. Once your project is linked you
 * can regenerate this instead, which is the better long-term habit:
 *
 *   npx supabase gen types typescript --linked > src/lib/domain/database.types.ts
 */

export type UserRole = "admin" | "member";

export type Profile = {
  id: string;
  alias: string;
  discord_id: string | null;
  role: UserRole;
  can_access_salary: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type Activity = {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  created_at: string;
}

export type Character = {
  id: string;
  user_id: string;
  name: string;
  job: string;
  sort_order: number;
  created_at: string;
}

export type Completion = {
  id: string;
  user_id: string;
  character_id: string;
  activity_id: string;
  week_of: string;
  done: boolean;
  updated_at: string;
}

export type Webhook = {
  id: string;
  name: string;
  url: string;
  is_default: boolean;
  updated_by: string | null;
  updated_at: string;
}

/** Name-only projection of `webhooks` — never carries the URL. */
export type WebhookOption = {
  id: string;
  name: string;
  is_default: boolean;
}

export type RosterUser = {
  id: string;
  alias: string;
  default_ign: string;
  discord_id: string;
  created_at: string;
}

export type Run = {
  id: string;
  name: string;
  ign: string;
  created_by: string | null;
  completed: boolean;
  ss_price: number;
  tax_per_trade: number;
  webhook_id: string | null;
  discord_thread_id: string;
  discord_initial_message_id: string;
  discord_item_message_id: string;
  discord_summary_message_id: string;
  created_at: string;
}

export type RunPlayer = {
  id: string;
  run_id: string;
  roster_user_id: string | null;
  name: string;
  ign: string;
  discord_id: string;
  ss_used: number;
  paid: boolean;
  sort_order: number;
}

export type LootItem = {
  id: string;
  run_id: string;
  name: string;
  sold_price: number;
  sold: boolean;
  sort_order: number;
}

export type AppSettings = {
  id: boolean;
  lfp_message: string;
  updated_at: string;
}

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile>;
      activities: Table<Activity>;
      characters: Table<Character>;
      completions: Table<Completion>;
      webhooks: Table<Webhook>;
      roster_users: Table<RosterUser>;
      runs: Table<Run>;
      run_players: Table<RunPlayer>;
      loot_items: Table<LootItem>;
      app_settings: Table<AppSettings>;
    };
    Views: {
      webhook_options: {
        Row: WebhookOption;
        Relationships: [];
      };
    };
    Functions: {
      is_admin: { Args: Record<never, never>; Returns: boolean };
      is_active_user: { Args: Record<never, never>; Returns: boolean };
      has_salary_access: { Args: Record<never, never>; Returns: boolean };
      can_edit_run: { Args: { p_run_id: string }; Returns: boolean };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}
