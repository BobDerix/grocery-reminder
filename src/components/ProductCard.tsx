"use client";

import { ProductWithTiming } from "@/lib/types";
import { createClient } from "@/lib/supabase";

interface ProductCardProps {
  product: ProductWithTiming;
  onUpdate: () => void;
  onEdit: (product: ProductWithTiming) => void;
}

export default function ProductCard({
  product,
  onUpdate,
  onEdit,
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
      // Herhalend: reset timer
      await supabase
        .from("products")
        .update({
          status: "stocked",
          last_restocked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);
    } else {
      // Eenmalig: deactiveer
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
          {product.shop_url && (
            <a
              href={product.shop_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline mt-1 inline-flex items-center gap-1"
            >
              {"\uD83D\uDED2"} Bestel online
            </a>
          )}
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        {product.status !== "stocked" ? (
          <button
            onClick={markBought}
            className="text-xs px-3 py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center gap-1"
          >
            {"\u2705"} Gekocht
          </button>
        ) : (
          <button
            onClick={addToList}
            className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1"
          >
            {"\uD83D\uDCDD"} Op lijstje
          </button>
        )}
        <button
          onClick={() => onEdit(product)}
          className="text-xs px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
        >
          {"\u270F\uFE0F"} Bewerk
        </button>
        <button
          onClick={removeProduct}
          className="text-xs px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors ml-auto"
        >
          {"\uD83D\uDDD1\uFE0F"}
        </button>
      </div>
    </div>
  );
}
