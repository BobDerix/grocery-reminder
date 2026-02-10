"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { Product } from "@/lib/types";

interface ProductFormProps {
  householdId: string;
  existingProduct?: Product | null;
  onSaved: () => void;
  onCancel: () => void;
}

const CATEGORIES = [
  "Zuivel",
  "Groente & Fruit",
  "Brood & Beleg",
  "Vlees & Vis",
  "Dranken",
  "Snacks",
  "Schoonmaak",
  "Verzorging",
  "Overig",
];

export default function ProductForm({
  householdId,
  existingProduct,
  onSaved,
  onCancel,
}: ProductFormProps) {
  const supabase = createClient();
  const [name, setName] = useState(existingProduct?.name ?? "");
  const [category, setCategory] = useState(existingProduct?.category ?? "");
  const [daysUntilEmpty, setDaysUntilEmpty] = useState<string>(
    existingProduct?.days_until_empty?.toString() ?? ""
  );
  const [remindDaysBefore, setRemindDaysBefore] = useState<string>(
    existingProduct?.remind_days_before?.toString() ?? ""
  );
  const [shopUrl, setShopUrl] = useState(existingProduct?.shop_url ?? "");
  const [isRecurring, setIsRecurring] = useState(
    existingProduct?.is_recurring ?? true
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const days = parseInt(daysUntilEmpty) || 7;
    const remind = parseInt(remindDaysBefore) || 2;

    setSaving(true);

    if (existingProduct) {
      await supabase
        .from("products")
        .update({
          name: name.trim(),
          category: category || null,
          days_until_empty: days,
          remind_days_before: remind,
          shop_url: shopUrl.trim() || null,
          is_recurring: isRecurring,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingProduct.id);
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      await supabase.from("products").insert({
        household_id: householdId,
        name: name.trim(),
        category: category || null,
        days_until_empty: days,
        remind_days_before: remind,
        shop_url: shopUrl.trim() || null,
        is_recurring: isRecurring,
        last_restocked_at: new Date().toISOString(),
        status: "stocked",
        is_active: true,
        added_by: user?.id ?? null,
      });
    }

    setSaving(false);
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <span>{existingProduct ? "\u270F\uFE0F" : "\u2795"}</span>
        {existingProduct ? "Product bewerken" : "Product toevoegen"}
      </h3>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Naam
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="bijv. Havermelk"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Categorie
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            <option value="">Geen categorie</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Eenmalig / Herhalend toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type aankoop
          </label>
          <div className="flex rounded-md overflow-hidden border border-gray-300">
            <button
              type="button"
              onClick={() => setIsRecurring(true)}
              className={`flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                isRecurring
                  ? "bg-green-600 text-white"
                  : "bg-white text-gray-600"
              }`}
            >
              {"\uD83D\uDD01"} Herhalend
            </button>
            <button
              type="button"
              onClick={() => setIsRecurring(false)}
              className={`flex-1 py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                !isRecurring
                  ? "bg-green-600 text-white"
                  : "bg-white text-gray-600"
              }`}
            >
              {"\u261D\uFE0F"} Eenmalig
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {isRecurring
              ? "Timer herstart automatisch na aankoop"
              : "Verdwijnt van de lijst na aankoop"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isRecurring ? "Dagen tot op" : "Nodig over (dagen)"}
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={daysUntilEmpty}
              onChange={(e) => setDaysUntilEmpty(e.target.value)}
              placeholder="7"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reminder (dagen vooraf)
            </label>
            <input
              type="number"
              min={0}
              max={365}
              value={remindDaysBefore}
              onChange={(e) => setRemindDaysBefore(e.target.value)}
              placeholder="2"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Webshop link <span className="text-gray-400 font-normal">(optioneel)</span>
          </label>
          <input
            type="url"
            value={shopUrl}
            onChange={(e) => setShopUrl(e.target.value)}
            placeholder="https://www.ah.nl/producten/..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Opslaan..." : existingProduct ? "Bijwerken" : "Toevoegen"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-300 transition-colors"
        >
          Annuleer
        </button>
      </div>
    </form>
  );
}
