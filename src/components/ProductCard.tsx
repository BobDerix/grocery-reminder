"use client";

import { ProductWithTiming } from "@/lib/types";
import { createClient } from "@/lib/supabase";

interface ProductCardProps {
  product: ProductWithTiming;
  onUpdate: () => void;
  onEdit: (product: ProductWithTiming) => void;
  context: "producten" | "nodig";
}

export default function ProductCard({
  product,
  onUpdate,
  onEdit,
  context,
}: ProductCardProps) {
  const supabase = createClient();
  const days = product.days_remaining;

  const urgencyColor =
    days <= 0
      ? "border-red-400 bg-red-50"
      : days <= product.remind_days_before
      ? "border-yellow-400 bg-yellow-50"
      : "border-green-400 bg-green-50";

  const badgeColor =
    days <= 0
      ? "bg-red-500 text-white"
      : days <= product.remind_days_before
      ? "bg-yellow-500 text-white"
      : "bg-green-500 text-white";

  async function markBought() {
    if (product.is_recurring) {
      await supabase
        .from("products")
        .update({
          status: "stocked",
          last_restocked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);
    } else {
      await supabase
        .from("products")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);
    }
    onUpdate();
  }

  async function addToList() {
    await supabase
      .from("products")
      .update({
        status: "on_list",
        updated_at: new Date().toISOString(),
      })
      .eq("id", product.id);
    onUpdate();
  }

  async function removeProduct() {
    await supabase
      .from("products")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", product.id);
    onUpdate();
  }

  // ── NODIG context: checklist-stijl ──
  if (context === "nodig") {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex items-center gap-3 p-3">
          {/* Cirkel om af te vinken */}
          <button
            onClick={markBought}
            className="w-7 h-7 rounded-full border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 transition-all flex-shrink-0 flex items-center justify-center group"
            title="Markeer als gekocht"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-transparent group-hover:text-green-500 transition-colors">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>

          {/* Product info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{product.name}</span>
              <span className="text-xs text-gray-400" title={product.is_recurring ? "Herhalend" : "Eenmalig"}>
                {product.is_recurring ? "\uD83D\uDD01" : "\u261D\uFE0F"}
              </span>
              {product.category && (
                <span className="text-xs text-gray-400">{product.category}</span>
              )}
            </div>
          </div>

          {/* Dagen badge */}
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
              days <= 0
                ? "bg-red-100 text-red-700"
                : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {days <= 0 ? "Op!" : `${days}d`}
          </span>
        </div>

        {/* Bestel online knop — prominent als shop_url beschikbaar */}
        {product.shop_url && (
          <a
            href={product.shop_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-700 text-sm font-medium hover:bg-blue-100 transition-colors border-t border-gray-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Bestel online
          </a>
        )}
      </div>
    );
  }

  // ── PRODUCTEN context: overzichtskaart ──
  return (
    <div className={`border-l-4 rounded-lg p-4 bg-white shadow-sm ${urgencyColor}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900">{product.name}</h3>
            {product.category && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                {product.category}
              </span>
            )}
            <span className="text-xs text-gray-400" title={product.is_recurring ? "Herhalend" : "Eenmalig"}>
              {product.is_recurring ? "\uD83D\uDD01" : "\u261D\uFE0F"}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}>
              {days <= 0 ? "Op!" : `${days}d`}
            </span>
            {" "}
            {days > 0 ? "resterend" : ""}
            <span className="text-gray-400"> · </span>
            <span className="text-gray-500">{"\uD83D\uDD14"} {product.remind_days_before}d vooraf</span>
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        {product.status === "stocked" && (
          <button
            onClick={addToList}
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Op lijstje
          </button>
        )}
        {product.status !== "stocked" && (
          <span className="text-xs px-3 py-1.5 bg-orange-100 text-orange-700 rounded-md font-medium">
            Staat op lijstje
          </span>
        )}
        <button
          onClick={() => onEdit(product)}
          className="text-xs px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors flex items-center gap-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Bewerk
        </button>
        <button
          onClick={removeProduct}
          className="text-xs px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors ml-auto"
          title="Verwijderen"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
