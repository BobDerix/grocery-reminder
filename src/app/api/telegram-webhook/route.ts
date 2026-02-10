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
    return NextResponse.json({ ok: true });
  }

  // /lijst or /nodig — show items that need to be bought
  if (text === "/list" || text === "/lijst" || text === "/nodig") {
    const { data: items } = await supabase
      .from("products_with_timing")
      .select("*")
      .eq("household_id", household.id)
      .in("status", ["on_list", "reminded"])
      .order("days_remaining", { ascending: true });

    if (!items || items.length === 0) {
      await sendTelegramMessage(chatId, "\uD83C\uDF89 Niets nodig! Alles op voorraad.");
    } else {
      const lines = items.map(
        (i) =>
          `  ${i.days_remaining <= 0 ? "\uD83D\uDD34" : "\uD83D\uDFE1"} ${i.name}${
            i.shop_url ? ` (<a href="${i.shop_url}">bestel</a>)` : ""
          }`
      );
      await sendTelegramMessage(
        chatId,
        `\uD83D\uDED2 <b>Nodig (${items.length}):</b>\n\n${lines.join("\n")}`
      );
    }
  }
  // /gekocht — mark product as bought
  else if (text.startsWith("/gekocht ") || text.startsWith("/bought ")) {
    const productName = text.replace(/^\/(gekocht|bought)\s+/, "").trim();

    if (!productName) {
      await sendTelegramMessage(chatId, "Gebruik: /gekocht <productnaam>");
      return NextResponse.json({ ok: true });
    }

    const { data: products } = await supabase
      .from("products")
      .select("id, name, is_recurring")
      .eq("household_id", household.id)
      .eq("is_active", true)
      .ilike("name", `%${productName}%`);

    if (!products || products.length === 0) {
      await sendTelegramMessage(
        chatId,
        `\u274C Product "${productName}" niet gevonden.`
      );
    } else {
      const product = products[0];

      if (product.is_recurring) {
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
          `\u2705 <b>${product.name}</b> gekocht! Timer is gereset.`
        );
      } else {
        await supabase
          .from("products")
          .update({
            is_active: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", product.id);
        await sendTelegramMessage(
          chatId,
          `\u2705 <b>${product.name}</b> gekocht en van de lijst verwijderd (eenmalig).`
        );
      }
    }
  }
  // /voeg — add a product
  else if (text.startsWith("/add ") || text.startsWith("/voeg ")) {
    const parts = text.replace(/^\/(add|voeg)\s+/, "").trim().split(/\s+/);

    if (parts.length < 2) {
      await sendTelegramMessage(
        chatId,
        "Gebruik: /voeg <naam> <dagen_tot_op> [reminder_dagen]\nBijv: /voeg Havermelk 7 2"
      );
      return NextResponse.json({ ok: true });
    }

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
      is_recurring: true,
      last_restocked_at: new Date().toISOString(),
      status: "stocked",
      is_active: true,
    });

    await sendTelegramMessage(
      chatId,
      `\u2795 <b>${name}</b> toegevoegd! ~${daysUntilEmpty}d voorraad, reminder ${remindDaysBefore}d vooraf.`
    );
  }
  // /voorraad — show all products with urgency
  else if (text === "/voorraad" || text === "/status") {
    const { data: products } = await supabase
      .from("products_with_timing")
      .select("*")
      .eq("household_id", household.id)
      .order("days_remaining", { ascending: true });

    if (!products || products.length === 0) {
      await sendTelegramMessage(chatId, "\uD83D\uDCE6 Nog geen producten bijgehouden.");
    } else {
      const lines = products.map((p) => {
        const emoji =
          p.days_remaining <= 0
            ? "\uD83D\uDD34"
            : p.days_remaining <= p.remind_days_before
            ? "\uD83D\uDFE1"
            : "\uD83D\uDFE2";
        const type = p.is_recurring ? "\uD83D\uDD01" : "\u261D\uFE0F";
        return `${emoji} ${p.name} ${type} — ${p.days_remaining}d`;
      });
      await sendTelegramMessage(
        chatId,
        `\uD83D\uDCE6 <b>Voorraad overzicht:</b>\n\n${lines.join("\n")}\n\n\uD83D\uDFE2 = ok  \uD83D\uDFE1 = bijna op  \uD83D\uDD34 = op`
      );
    }
  }
  // /snel — quick add to shopping list (doesn't create product, just marks existing as on_list)
  else if (text.startsWith("/snel ") || text.startsWith("/quick ")) {
    const productName = text.replace(/^\/(snel|quick)\s+/, "").trim();

    const { data: products } = await supabase
      .from("products")
      .select("id, name")
      .eq("household_id", household.id)
      .eq("is_active", true)
      .ilike("name", `%${productName}%`);

    if (!products || products.length === 0) {
      await sendTelegramMessage(
        chatId,
        `\u274C "${productName}" niet gevonden. Gebruik /voeg om het toe te voegen.`
      );
    } else {
      const product = products[0];
      await supabase
        .from("products")
        .update({ status: "on_list", updated_at: new Date().toISOString() })
        .eq("id", product.id);
      await sendTelegramMessage(
        chatId,
        `\uD83D\uDCDD <b>${product.name}</b> op het lijstje gezet!`
      );
    }
  }
  // /bijna — show products running low (within reminder window)
  else if (text === "/bijna" || text === "/urgent") {
    const { data: products } = await supabase
      .from("products_with_timing")
      .select("*")
      .eq("household_id", household.id)
      .eq("status", "stocked")
      .order("days_remaining", { ascending: true });

    const urgent = (products ?? []).filter(
      (p) => p.days_remaining <= p.remind_days_before
    );

    if (urgent.length === 0) {
      await sendTelegramMessage(chatId, "\u2705 Niets urgent! Alles nog op voorraad.");
    } else {
      const lines = urgent.map(
        (p) =>
          `  ${p.days_remaining <= 0 ? "\uD83D\uDD34" : "\uD83D\uDFE1"} ${p.name} — ${
            p.days_remaining <= 0 ? "OP!" : `${p.days_remaining}d`
          }`
      );
      await sendTelegramMessage(
        chatId,
        `\u26A0\uFE0F <b>Bijna op (${urgent.length}):</b>\n\n${lines.join("\n")}`
      );
    }
  }
  // /verwijder — remove a product
  else if (text.startsWith("/verwijder ") || text.startsWith("/delete ")) {
    const productName = text.replace(/^\/(verwijder|delete)\s+/, "").trim();

    const { data: products } = await supabase
      .from("products")
      .select("id, name")
      .eq("household_id", household.id)
      .eq("is_active", true)
      .ilike("name", `%${productName}%`);

    if (!products || products.length === 0) {
      await sendTelegramMessage(chatId, `\u274C "${productName}" niet gevonden.`);
    } else {
      const product = products[0];
      await supabase
        .from("products")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", product.id);
      await sendTelegramMessage(
        chatId,
        `\uD83D\uDDD1\uFE0F <b>${product.name}</b> verwijderd.`
      );
    }
  }
  // /help
  else if (text === "/help" || text === "/start") {
    await sendTelegramMessage(
      chatId,
      [
        "\uD83D\uDED2 <b>Boodschappen Reminder Bot</b>",
        "",
        "<b>Lijsten:</b>",
        "/nodig — Toon wat je moet kopen",
        "/voorraad — Toon alle producten",
        "/bijna — Toon wat bijna op is",
        "",
        "<b>Acties:</b>",
        "/gekocht &lt;naam&gt; — Markeer als gekocht",
        "/snel &lt;naam&gt; — Zet snel op het lijstje",
        "/voeg &lt;naam&gt; &lt;dagen&gt; [reminder] — Nieuw product",
        "/verwijder &lt;naam&gt; — Verwijder product",
        "",
        "<b>Tip:</b> Je kunt ook gedeeltelijke namen gebruiken!",
        "Bijv: /gekocht haver (vindt Havermelk)",
      ].join("\n")
    );
  }

  return NextResponse.json({ ok: true });
}
