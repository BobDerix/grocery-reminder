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

  // Alleen producten die op voorraad zijn (stocked) of op de lijst staan
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

        {/* Producten op de lijst — klein indicatieblok */}
        {onList.length > 0 && (
          <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-orange-500">
                <circle cx="8" cy="21" r="1" />
                <circle cx="19" cy="21" r="1" />
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
              </svg>
              <span className="text-sm font-medium text-orange-800">
                {onList.length} {onList.length === 1 ? "product" : "producten"} op het lijstje
              </span>
            </div>
            <a
              href="/shopping-list"
              className="text-xs font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 px-3 py-1.5 rounded-md transition-colors"
            >
              Bekijk
            </a>
          </div>
        )}

        {/* Alle producten op voorraad */}
        {stocked.length === 0 && onList.length === 0 ? (
          <div className="text-center py-12">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-12 h-12 text-gray-300 mx-auto mb-3">
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
              <path d="m3.3 7 8.7 5 8.7-5" />
              <path d="M12 22V12" />
            </svg>
            <p className="text-gray-400 text-sm">
              Nog geen producten. Voeg je eerste product toe!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {stocked.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onUpdate={loadData}
                onEdit={handleEdit}
                context="producten"
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
