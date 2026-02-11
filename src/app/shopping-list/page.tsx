"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { ProductWithTiming } from "@/lib/types";
import Navbar from "@/components/Navbar";
import ProductCard from "@/components/ProductCard";

export default function ShoppingListPage() {
  const supabase = createClient();
  const [items, setItems] = useState<ProductWithTiming[]>([]);
  const [householdId, setHouseholdId] = useState<string | null>(null);
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

    setHouseholdId(membership.household_id);

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

  // Dummy edit handler — op de Nodig-pagina kun je niet bewerken
  function handleEdit() {
    // Intentionally empty — editing is done on the Producten page
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-gray-300 mx-auto mb-3">
              <circle cx="8" cy="21" r="1" />
              <circle cx="19" cy="21" r="1" />
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
            </svg>
            <p className="text-gray-500 text-sm mb-1">
              Niets nodig!
            </p>
            <p className="text-gray-400 text-xs">
              Alles is op voorraad. Producten verschijnen hier automatisch als ze bijna op zijn.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                onUpdate={loadItems}
                onEdit={handleEdit}
                context="nodig"
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
