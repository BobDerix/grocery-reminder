"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface Reminder {
  id: string;
  household_id: string;
  title: string;
  description: string | null;
  due_date: string;
  repeat_days: number | null;
  is_done: boolean;
  created_at: string;
}

export default function RemindersPage() {
  const supabase = createClient();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [repeatDays, setRepeatDays] = useState<string>("");
  const [saving, setSaving] = useState(false);

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

    const { data } = await supabase
      .from("reminders")
      .select("*")
      .eq("household_id", membership.household_id)
      .order("due_date", { ascending: true });

    setReminders((data as Reminder[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openForm(reminder?: Reminder) {
    if (reminder) {
      setEditingReminder(reminder);
      setTitle(reminder.title);
      setDescription(reminder.description ?? "");
      setDueDate(reminder.due_date.split("T")[0]);
      setRepeatDays(reminder.repeat_days?.toString() ?? "");
    } else {
      setEditingReminder(null);
      setTitle("");
      setDescription("");
      setDueDate("");
      setRepeatDays("");
    }
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingReminder(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !dueDate) return;

    setSaving(true);

    const data = {
      title: title.trim(),
      description: description.trim() || null,
      due_date: new Date(dueDate).toISOString(),
      repeat_days: repeatDays ? parseInt(repeatDays) : null,
    };

    if (editingReminder) {
      await supabase
        .from("reminders")
        .update(data)
        .eq("id", editingReminder.id);
    } else {
      await supabase.from("reminders").insert({
        ...data,
        household_id: householdId,
        is_done: false,
      });
    }

    setSaving(false);
    closeForm();
    loadData();
  }

  async function toggleDone(reminder: Reminder) {
    if (!reminder.is_done && reminder.repeat_days) {
      // Als herhalend: verplaats de datum in plaats van afvinken
      const newDate = new Date(reminder.due_date);
      newDate.setDate(newDate.getDate() + reminder.repeat_days);
      await supabase
        .from("reminders")
        .update({ due_date: newDate.toISOString() })
        .eq("id", reminder.id);
    } else {
      await supabase
        .from("reminders")
        .update({ is_done: !reminder.is_done })
        .eq("id", reminder.id);
    }
    loadData();
  }

  async function deleteReminder(id: string) {
    await supabase.from("reminders").delete().eq("id", id);
    loadData();
  }

  const today = new Date().toISOString().split("T")[0];
  const upcoming = reminders.filter((r) => !r.is_done);
  const done = reminders.filter((r) => r.is_done);

  function isOverdue(dateStr: string) {
    return dateStr.split("T")[0] < today;
  }

  return (
    <>
      <Navbar />
      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Herinneringen</h2>
          <button
            onClick={() => openForm()}
            className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 transition-colors"
          >
            + Herinnering
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 mb-4 space-y-3"
          >
            <h3 className="font-semibold">
              {editingReminder ? "Herinnering bewerken" : "Nieuwe herinnering"}
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Titel
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="bijv. Stofzuigerzak vervangen"
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Omschrijving{" "}
                <span className="text-gray-400 font-normal">(optioneel)</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Extra details..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Datum
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Herhaal elke{" "}
                  <span className="text-gray-400 font-normal">(dagen)</span>
                </label>
                <input
                  type="number"
                  min={1}
                  value={repeatDays}
                  onChange={(e) => setRepeatDays(e.target.value)}
                  placeholder="Eenmalig"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {saving
                  ? "Opslaan..."
                  : editingReminder
                  ? "Bijwerken"
                  : "Toevoegen"}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-300 transition-colors"
              >
                Annuleer
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-gray-500 text-center py-8">Laden...</p>
        ) : upcoming.length === 0 && done.length === 0 ? (
          <p className="text-gray-400 text-sm py-12 text-center">
            Nog geen herinneringen. Voeg er een toe!
          </p>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div className="space-y-2 mb-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Aankomend ({upcoming.length})
                </h3>
                {upcoming.map((r) => (
                  <div
                    key={r.id}
                    className={`flex items-start gap-3 bg-white p-3 rounded-lg shadow-sm border ${
                      isOverdue(r.due_date)
                        ? "border-red-300 bg-red-50"
                        : "border-gray-200"
                    }`}
                  >
                    <button
                      onClick={() => toggleDone(r)}
                      className="w-5 h-5 mt-0.5 rounded-full border-2 border-gray-300 hover:border-purple-500 hover:bg-purple-50 transition-colors flex-shrink-0"
                      title={r.repeat_days ? "Volgende cyclus" : "Afvinken"}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {r.title}
                        </span>
                        {r.repeat_days && (
                          <span className="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                            elke {r.repeat_days}d
                          </span>
                        )}
                      </div>
                      {r.description && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {r.description}
                        </p>
                      )}
                      <p
                        className={`text-xs mt-0.5 ${
                          isOverdue(r.due_date)
                            ? "text-red-600 font-medium"
                            : "text-gray-400"
                        }`}
                      >
                        {isOverdue(r.due_date) ? "Verlopen: " : ""}
                        {new Date(r.due_date).toLocaleDateString("nl-NL", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => openForm(r)}
                        className="text-xs px-2 py-1 text-gray-500 hover:bg-gray-100 rounded transition-colors"
                      >
                        Bewerk
                      </button>
                      <button
                        onClick={() => deleteReminder(r.id)}
                        className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        Verwijder
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {done.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Afgerond ({done.length})
                </h3>
                {done.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 bg-white p-3 rounded-lg shadow-sm border border-gray-200 opacity-60"
                  >
                    <button
                      onClick={() => toggleDone(r)}
                      className="w-5 h-5 rounded-full bg-purple-500 border-2 border-purple-500 flex-shrink-0 flex items-center justify-center"
                      title="Ongedaan maken"
                    >
                      <span className="text-white text-xs">✓</span>
                    </button>
                    <span className="font-medium text-gray-500 line-through">
                      {r.title}
                    </span>
                    <button
                      onClick={() => deleteReminder(r.id)}
                      className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded transition-colors ml-auto"
                    >
                      Verwijder
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
