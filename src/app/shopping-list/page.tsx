"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { ProductWithTiming } from "@/lib/types";
import Navbar from "@/components/Navbar";

export default function ShoppingListPage() {
  const supabase = createClient();
  const [items, setItems] = useState<ProductWithTiming[]>([]);
  const [loading, setLoading] = useState(true);

  const loadItems = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from("products_with_timing")
      .select("*")
      .eq("household_id", membership.household_id)
      .in("status", ["on_list", "reminded"])
      .order("days_remaining", { ascending: true });

    setItems((data as ProductWithTiming[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  async function markBought(item: ProductWithTiming) {
    if (item.is_recurring) {
      await supabase
        .from("products")
        .update({
          status: "stocked",
          last_restocked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
    } else {
      await supabase
        .from("products")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
    }
    loadItems();
  }

  async function markAllBought() {
    const recurring = items.filter((i) => i.is_recurring);
    const oneTime = items.filter((i) => !i.is_recurring);

    if (recurring.length > 0) {
      await supabase
        .from("products")
        .update({
          status: "stocked",
          last_restocked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in("id", recurring.map((i) => i.id));
    }

    if (oneTime.length > 0) {
      await supabase
        .from("products")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .in("id", oneTime.map((i) => i.id));
    }

    loadItems();
  }

  return (
    <>
      <Navbar />
      <main className="max-w-lg mx-auto px-4 py-4">
        {items.length > 0 && (
          <div className="flex items-center justify-end mb-4">
            <button
              onClick={markAllBought}
              className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Alles gekocht
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 text-center py-8">Laden...</p>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">{"\uD83C\uDF89"}</p>
            <p className="text-gray-500 text-sm">
              Niets nodig! Alles is op voorraad.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 bg-white p-3 rounded-lg shadow-sm border border-gray-200"
              >
                <button
                  onClick={() => markBought(item)}
                  className="w-6 h-6 rounded-full border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 transition-colors flex-shrink-0"
                  title="Markeer als gekocht"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{item.name}</span>
                    <span className="text-xs text-gray-400" title={item.is_recurring ? "Herhalend" : "Eenmalig"}>
                      {item.is_recurring ? "\uD83D\uDD01" : "\u261D\uFE0F"}
                    </span>
                    {item.category && (
                      <span className="text-xs text-gray-400">
                        {item.category}
                      </span>
                    )}
                  </div>
                  {item.shop_url && (
                    <a
                      href={item.shop_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      {"\uD83D\uDED2"} Bestel online
                    </a>
                  )}
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    item.days_remaining <= 0
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {item.days_remaining <= 0
                    ? "Op!"
                    : `${item.days_remaining}d`}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
