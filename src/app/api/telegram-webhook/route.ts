import { createClient } from "@supabase/supabase-js";
import { sendTelegramMessage } from "@/lib/telegram";
import { NextRequest, NextResponse } from "next/server";

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface TelegramUpdate {
  message?: {
    chat: { id: number };
    text?: string;
    from?: { first_name?: string };
  };
}

export async function POST(request: NextRequest) {
  const body: TelegramUpdate = await request.json();

  const message = body.message;
  if (!message?.text) {
    return NextResponse.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const text = message.text.trim();
  const supabase = createServiceClient();

  // Find household by telegram_chat_id
  const { data: household } = await supabase
    .from("households")
    .select("id")
    .eq("telegram_chat_id", chatId)
    .single();

  if (!household) {
    // Not a registered household
    return NextResponse.json({ ok: true });
  }

  if (text === "/list" || text === "/lijst") {
    // Show current shopping list
    const { data: items } = await supabase
      .from("products_with_timing")
      .select("*")
      .eq("household_id", household.id)
      .in("status", ["on_list", "reminded"])
      .order("days_remaining", { ascending: true });

    if (!items || items.length === 0) {
      await sendTelegramMessage(chatId, "Geen boodschappen nodig! Alles op voorraad.");
    } else {
      const lines = items.map(
        (i) =>
          `  - ${i.name}${i.days_remaining <= 0 ? " (OP!)" : ` (${i.days_remaining}d)`}`
      );
      await sendTelegramMessage(
        chatId,
        `<b>Boodschappenlijst:</b>\n\n${lines.join("\n")}`
      );
    }
  } else if (text.startsWith("/gekocht ") || text.startsWith("/bought ")) {
    const productName = text.replace(/^\/(gekocht|bought)\s+/, "").trim();

    if (!productName) {
      await sendTelegramMessage(chatId, "Gebruik: /gekocht <productnaam>");
      return NextResponse.json({ ok: true });
    }

    // Find and update the product (case-insensitive match)
    const { data: products } = await supabase
      .from("products")
      .select("id, name")
      .eq("household_id", household.id)
      .eq("is_active", true)
      .ilike("name", `%${productName}%`);

    if (!products || products.length === 0) {
      await sendTelegramMessage(
        chatId,
        `Product "${productName}" niet gevonden.`
      );
    } else {
      const product = products[0];
      await supabase
        .from("products")
        .update({
          status: "stocked",
          last_restocked_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);

      await sendTelegramMessage(
        chatId,
        `<b>${product.name}</b> is gemarkeerd als gekocht! Timer is gereset.`
      );
    }
  } else if (text.startsWith("/add ") || text.startsWith("/voeg ")) {
    // /add <naam> <dagen> [reminder_dagen]
    const parts = text.replace(/^\/(add|voeg)\s+/, "").trim().split(/\s+/);

    if (parts.length < 2) {
      await sendTelegramMessage(
        chatId,
        "Gebruik: /voeg <naam> <dagen_tot_op> [reminder_dagen]\nBijv: /voeg Havermelk 7 2"
      );
      return NextResponse.json({ ok: true });
    }

    // Last 1-2 items are numbers, rest is the name
    const lastTwo = parts.slice(-2);
    const lastOne = parts.slice(-1);

    let name: string;
    let daysUntilEmpty: number;
    let remindDaysBefore = 2;

    if (
      parts.length >= 3 &&
      !isNaN(Number(lastTwo[0])) &&
      !isNaN(Number(lastTwo[1]))
    ) {
      name = parts.slice(0, -2).join(" ");
      daysUntilEmpty = parseInt(lastTwo[0]);
      remindDaysBefore = parseInt(lastTwo[1]);
    } else if (!isNaN(Number(lastOne[0]))) {
      name = parts.slice(0, -1).join(" ");
      daysUntilEmpty = parseInt(lastOne[0]);
    } else {
      await sendTelegramMessage(
        chatId,
        "Gebruik: /voeg <naam> <dagen_tot_op> [reminder_dagen]\nBijv: /voeg Havermelk 7 2"
      );
      return NextResponse.json({ ok: true });
    }

    await supabase.from("products").insert({
      household_id: household.id,
      name,
      days_until_empty: daysUntilEmpty,
      remind_days_before: remindDaysBefore,
      last_restocked_at: new Date().toISOString(),
      status: "stocked",
      is_active: true,
    });

    await sendTelegramMessage(
      chatId,
      `<b>${name}</b> toegevoegd! Gaat ~${daysUntilEmpty} dagen mee, reminder ${remindDaysBefore} dagen van tevoren.`
    );
  } else if (text === "/voorraad" || text === "/status") {
    // Show all products with their status
    const { data: products } = await supabase
      .from("products_with_timing")
      .select("*")
      .eq("household_id", household.id)
      .order("days_remaining", { ascending: true });

    if (!products || products.length === 0) {
      await sendTelegramMessage(chatId, "Nog geen producten bijgehouden.");
    } else {
      const lines = products.map((p) => {
        const emoji =
          p.days_remaining <= 0
            ? "!!!"
            : p.days_remaining <= p.remind_days_before
            ? "(!)"
            : "   ";
        return `${emoji} ${p.name}: ${p.days_remaining}d resterend`;
      });
      await sendTelegramMessage(
        chatId,
        `<b>Voorraad overzicht:</b>\n\n${lines.join("\n")}`
      );
    }
  } else if (text === "/help") {
    await sendTelegramMessage(
      chatId,
      [
        "<b>Beschikbare commando's:</b>",
        "",
        "/lijst - Toon boodschappenlijst",
        "/voorraad - Toon alle producten met status",
        "/gekocht &lt;naam&gt; - Markeer product als gekocht",
        "/voeg &lt;naam&gt; &lt;dagen&gt; [reminder] - Voeg product toe",
        "/help - Toon dit menu",
      ].join("\n")
    );
  }

  return NextResponse.json({ ok: true });
}
