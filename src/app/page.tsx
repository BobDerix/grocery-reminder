"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { ProductWithTiming } from "@/lib/types";
import Navbar from "@/components/Navbar";
import ProductCard from "@/components/ProductCard";
import ProductForm from "@/components/ProductForm";

export default function HomePage() {
  const supabase = createClient();
  const [products, setProducts] = useState<ProductWithTiming[]>([]);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithTiming | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    // Get user's household
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

    // Load products with timing
    const { data: prods } = await supabase
      .from("products_with_timing")
      .select("*")
      .eq("household_id", membership.household_id)
      .order("days_remaining", { ascending: true });

    setProducts((prods as ProductWithTiming[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleSaved() {
    setShowForm(false);
    setEditingProduct(null);
    loadData();
  }

  function handleEdit(product: ProductWithTiming) {
    setEditingProduct(product);
    setShowForm(true);
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="max-w-lg mx-auto px-4 py-12 text-center text-gray-500">
          Laden...
        </div>
      </>
    );
  }

  if (!householdId) {
    return (
      <>
        <Navbar />
        <div className="max-w-lg mx-auto px-4 py-12 text-center">
          <p className="text-gray-500 mb-2">
            Je bent nog niet aan een huishouden gekoppeld.
          </p>
          <p className="text-sm text-gray-400">
            Log uit en registreer opnieuw, of vraag je partner om een
            uitnodigingscode.
          </p>
        </div>
      </>
    );
  }

  const stocked = products.filter((p) => p.status === "stocked");
  const onList = products.filter(
    (p) => p.status === "on_list" || p.status === "reminded"
  );

  return (
    <>
      <Navbar />
      <main className="max-w-lg mx-auto px-4 py-4">
        <div className="flex items-center justify-end mb-4">
          <button
            onClick={() => {
              setEditingProduct(null);
              setShowForm(!showForm);
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Product
          </button>
        </div>

        {showForm && (
          <div className="mb-4">
            <ProductForm
              householdId={householdId}
              existingProduct={editingProduct}
              onSaved={handleSaved}
              onCancel={() => {
                setShowForm(false);
                setEditingProduct(null);
              }}
            />
          </div>
        )}

        {onList.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Op het lijstje ({onList.length})
            </h3>
            <div className="space-y-2">
              {onList.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onUpdate={loadData}
                  onEdit={handleEdit}
                />
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Op voorraad ({stocked.length})
          </h3>
          {stocked.length === 0 ? (
            <p className="text-gray-400 text-sm py-8 text-center">
              Nog geen producten. Voeg je eerste product toe!
            </p>
          ) : (
            <div className="space-y-2">
              {stocked.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onUpdate={loadData}
                  onEdit={handleEdit}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
