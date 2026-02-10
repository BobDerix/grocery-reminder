import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "@/lib/telegram";
import { NextRequest, NextResponse } from "next/server";

// Use service role for cron jobs — bypasses RLS
function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  // Verify the request is from Vercel Cron or has correct secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Find products that need a reminder: remind_at <= now() and still stocked
  const { data: dueProducts, error } = await supabase
    .from("products_with_timing")
    .select("*, households(telegram_chat_id)")
    .lte("remind_at", new Date().toISOString())
    .eq("status", "stocked");

  if (error) {
    console.error("Error fetching due products:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!dueProducts || dueProducts.length === 0) {
    return NextResponse.json({ message: "No reminders due", sent: 0 });
  }

  // Group by household
  const byHousehold: Record<
    string,
    { chatId: string; products: typeof dueProducts }
  > = {};

  for (const product of dueProducts) {
    const hhId = product.household_id;
    const chatId = (product as Record<string, unknown>).households as { telegram_chat_id: string | null } | null;

    if (!chatId?.telegram_chat_id) continue;

    if (!byHousehold[hhId]) {
      byHousehold[hhId] = {
        chatId: chatId.telegram_chat_id,
        products: [],
      };
    }
    byHousehold[hhId].products.push(product);
  }

  let sentCount = 0;

  for (const [householdId, { chatId, products }] of Object.entries(
    byHousehold
  )) {
    const lines = products.map(
      (p) =>
        `  - <b>${p.name}</b> (nog ~${p.days_remaining} dag${p.days_remaining !== 1 ? "en" : ""})`
    );

    const message = [
      "Boodschappen reminder!",
      "",
      "Deze producten zijn bijna op:",
      ...lines,
      "",
      "Tijd om te bestellen!",
    ].join("\n");

    const success = await sendTelegramMessage(chatId, message);

    if (success) {
      sentCount++;

      // Update status to 'reminded'
      const productIds = products.map((p) => p.id);
      await supabase
        .from("products")
        .update({ status: "reminded", updated_at: new Date().toISOString() })
        .in("id", productIds);

      // Log reminders
      for (const p of products) {
        await supabase.from("reminder_log").insert({
          product_id: p.id,
          message,
        });
      }
    }
  }

  // Also check general reminders
  const today = new Date().toISOString();
  const { data: dueReminders } = await supabase
    .from("reminders")
    .select("*, households(telegram_chat_id)")
    .lte("due_date", today)
    .eq("is_done", false);

  if (dueReminders && dueReminders.length > 0) {
    const remindersByHH: Record<string, { chatId: string; items: typeof dueReminders }> = {};

    for (const r of dueReminders) {
      const hhId = r.household_id;
      const hh = (r as Record<string, unknown>).households as { telegram_chat_id: string | null } | null;
      if (!hh?.telegram_chat_id) continue;

      if (!remindersByHH[hhId]) {
        remindersByHH[hhId] = { chatId: hh.telegram_chat_id, items: [] };
      }
      remindersByHH[hhId].items.push(r);
    }

    for (const [, { chatId, items }] of Object.entries(remindersByHH)) {
      const lines = items.map((r) => `  - <b>${r.title}</b>${r.description ? ` (${r.description})` : ""}`);
      const msg = ["Herinneringen voor vandaag:", "", ...lines].join("\n");
      await sendTelegramMessage(chatId, msg);
      sentCount++;
    }
  }

  return NextResponse.json({
    message: `Sent ${sentCount} reminder(s)`,
    sent: sentCount,
    productsChecked: dueProducts?.length ?? 0,
    remindersChecked: dueReminders?.length ?? 0,
  });
}
