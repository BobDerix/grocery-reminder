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

  async function markBought(id: string) {
    await supabase
      .from("products")
      .update({
        status: "stocked",
        last_restocked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    loadItems();
  }

  async function markAllBought() {
    const ids = items.map((i) => i.id);
    await supabase
      .from("products")
      .update({
        status: "stocked",
        last_restocked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .in("id", ids);
    loadItems();
  }

  return (
    <>
      <Navbar />
      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Boodschappenlijst</h2>
          {items.length > 0 && (
            <button
              onClick={markAllBought}
              className="px-3 py-1.5 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700 transition-colors"
            >
              Alles gekocht
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-gray-500 text-center py-8">Laden...</p>
        ) : items.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-sm">
              Geen boodschappen nodig! Alles is op voorraad.
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
                  onClick={() => markBought(item.id)}
                  className="w-6 h-6 rounded-full border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 transition-colors flex-shrink-0"
                  title="Markeer als gekocht"
                />
                <div className="flex-1">
                  <span className="font-medium text-gray-900">{item.name}</span>
                  {item.category && (
                    <span className="text-xs text-gray-500 ml-2">
                      {item.category}
                    </span>
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
