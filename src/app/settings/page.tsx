"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import { Household } from "@/lib/types";
import Navbar from "@/components/Navbar";

export default function SettingsPage() {
  const supabase = createClient();
  const [household, setHousehold] = useState<Household | null>(null);
  const [telegramChatId, setTelegramChatId] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadHousehold = useCallback(async () => {
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

    const { data: hh } = await supabase
      .from("households")
      .select("*")
      .eq("id", membership.household_id)
      .single();

    if (hh) {
      setHousehold(hh as Household);
      setTelegramChatId(hh.telegram_chat_id ?? "");
      setHouseholdName(hh.name);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadHousehold();
  }, [loadHousehold]);

  async function handleSave() {
    if (!household) return;
    setSaving(true);
    setSaved(false);

    await supabase
      .from("households")
      .update({
        name: householdName,
        telegram_chat_id: telegramChatId || null,
      })
      .eq("id", household.id);

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function copyInviteCode() {
    if (!household) return;
    navigator.clipboard.writeText(household.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  if (!household) {
    return (
      <>
        <Navbar />
        <div className="max-w-lg mx-auto px-4 py-12 text-center text-gray-500">
          Geen huishouden gevonden.
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <h2 className="text-lg font-bold">Instellingen</h2>

        {/* Household settings */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-4">
          <h3 className="font-semibold">Huishouden</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Naam
            </label>
            <input
              type="text"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Uitnodigingscode
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={household.invite_code}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 font-mono"
              />
              <button
                onClick={copyInviteCode}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md text-sm hover:bg-gray-300 transition-colors"
              >
                {copied ? "Gekopieerd!" : "Kopieer"}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Deel deze code met je partner om samen een boodschappenlijst te
              delen.
            </p>
          </div>
        </div>

        {/* Telegram settings */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 space-y-4">
          <h3 className="font-semibold">Telegram Notificaties</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Telegram Chat ID
            </label>
            <input
              type="text"
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value)}
              placeholder="bijv. -1001234567890"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div className="bg-gray-50 p-3 rounded-md text-xs text-gray-600 space-y-2">
            <p className="font-medium text-gray-700">Hoe stel je dit in?</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Open Telegram en zoek @BotFather</li>
              <li>Stuur /newbot en volg de stappen</li>
              <li>Kopieer de bot token naar je .env.local bestand</li>
              <li>Maak een groep aan en voeg de bot toe</li>
              <li>
                Stuur een bericht in de groep, ga dan naar:
                <br />
                <code className="bg-gray-200 px-1 rounded">
                  https://api.telegram.org/bot&lt;TOKEN&gt;/getUpdates
                </code>
              </li>
              <li>Zoek het &quot;chat&quot; object en kopieer het &quot;id&quot; (begint met -)</li>
              <li>Plak dat ID hierboven</li>
            </ol>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Opslaan..." : saved ? "Opgeslagen!" : "Opslaan"}
        </button>
      </main>
    </>
  );
}
