export interface Product {
  id: string;
  household_id: string;
  name: string;
  category: string | null;
  days_until_empty: number;
  remind_days_before: number;
  last_restocked_at: string;
  status: "stocked" | "reminded" | "on_list" | "bought";
  is_active: boolean;
  added_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductWithTiming extends Product {
  runs_out_at: string;
  remind_at: string;
  days_remaining: number;
}

export interface Household {
  id: string;
  name: string;
  telegram_chat_id: string | null;
  invite_code: string;
  created_at: string;
}
