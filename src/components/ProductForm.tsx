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
  const [daysUntilEmpty, setDaysUntilEmpty] = useState(
    existingProduct?.days_until_empty ?? 7
  );
  const [remindDaysBefore, setRemindDaysBefore] = useState(
    existingProduct?.remind_days_before ?? 2
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);

    if (existingProduct) {
      await supabase
        .from("products")
        .update({
          name: name.trim(),
          category: category || null,
          days_until_empty: daysUntilEmpty,
          remind_days_before: remindDaysBefore,
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
        days_until_empty: daysUntilEmpty,
        remind_days_before: remindDaysBefore,
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
      <h3 className="font-semibold mb-3">
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dagen tot op
            </label>
            <input
              type="number"
              min={1}
              max={365}
              value={daysUntilEmpty}
              onChange={(e) => setDaysUntilEmpty(Number(e.target.value))}
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
              max={daysUntilEmpty}
              value={remindDaysBefore}
              onChange={(e) => setRemindDaysBefore(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              required
            />
          </div>
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
