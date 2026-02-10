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

  // Strip bot username suffix (e.g. /nodig@MyBot)
  const command = text.split("@")[0];

  // Find household by telegram_chat_id
  const { data: household } = await supabase
    .from("households")
    .select("id")
    .eq("telegram_chat_id", chatId)
    .single();

  if (!household) {
    return NextResponse.json({ ok: true });
  }

  // ──────────────────────────────────────
  // PRODUCTEN
  // ──────────────────────────────────────

  // /nodig — toon boodschappenlijst
  if (command === "/nodig" || command === "/lijst" || command === "/list") {
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

  // /voorraad — toon alle producten met urgentie
  else if (command === "/voorraad" || command === "/producten" || command === "/status") {
    const { data: products } = await supabase
      .from("products_with_timing")
      .select("*")
      .eq("household_id", household.id)
      .order("days_remaining", { ascending: true });

    if (!products || products.length === 0) {
      await sendTelegramMessage(chatId, "\uD83D\uDCE6 Nog geen producten.");
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
        `\uD83D\uDCE6 <b>Producten (${products.length}):</b>\n\n${lines.join("\n")}\n\n\uD83D\uDFE2 ok  \uD83D\uDFE1 bijna op  \uD83D\uDD34 op`
      );
    }
  }

  // /bijna — toon producten die bijna op zijn
  else if (command === "/bijna" || command === "/urgent") {
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

  // /gekocht — markeer product als gekocht
  else if (command.startsWith("/gekocht ") || command.startsWith("/bought ")) {
    const productName = command.replace(/^\/(gekocht|bought)\s+/, "").trim();

    if (!productName) {
      await sendTelegramMessage(chatId, "Gebruik: /gekocht <i>productnaam</i>");
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
          `\u2705 <b>${product.name}</b> gekocht! Timer gereset.`
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
          `\u2705 <b>${product.name}</b> gekocht en verwijderd (eenmalig).`
        );
      }
    }
  }

  // /snel — snel een product op het lijstje zetten, of aanmaken als het niet bestaat
  else if (command.startsWith("/snel ") || command.startsWith("/quick ")) {
    const productName = command.replace(/^\/(snel|quick)\s+/, "").trim();

    if (!productName) {
      await sendTelegramMessage(chatId, "Gebruik: /snel <i>productnaam</i>");
      return NextResponse.json({ ok: true });
    }

    // Zoek of het product al bestaat
    const { data: products } = await supabase
      .from("products")
      .select("id, name")
      .eq("household_id", household.id)
      .eq("is_active", true)
      .ilike("name", `%${productName}%`);

    if (products && products.length > 0) {
      // Bestaat al → op het lijstje zetten
      const product = products[0];
      await supabase
        .from("products")
        .update({ status: "on_list", updated_at: new Date().toISOString() })
        .eq("id", product.id);
      await sendTelegramMessage(
        chatId,
        `\uD83D\uDCDD <b>${product.name}</b> op het lijstje gezet!`
      );
    } else {
      // Bestaat niet → nieuw eenmalig product aanmaken en direct op de lijst
      await supabase.from("products").insert({
        household_id: household.id,
        name: productName,
        days_until_empty: 7,
        remind_days_before: 2,
        is_recurring: false,
        last_restocked_at: new Date().toISOString(),
        status: "on_list",
        is_active: true,
      });
      await sendTelegramMessage(
        chatId,
        `\uD83D\uDCDD <b>${productName}</b> aangemaakt en op het lijstje gezet!\n<i>(Eenmalig — verdwijnt na aankoop. Pas aan in de app voor meer opties.)</i>`
      );
    }
  }

  // /voeg — product toevoegen met dagen
  else if (command.startsWith("/voeg ") || command.startsWith("/add ")) {
    const parts = command.replace(/^\/(add|voeg)\s+/, "").trim().split(/\s+/);

    if (parts.length < 2) {
      await sendTelegramMessage(
        chatId,
        "Gebruik: /voeg <i>naam</i> <i>dagen</i> [reminder]\nBijv: /voeg Havermelk 7 2"
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
        "Gebruik: /voeg <i>naam</i> <i>dagen</i> [reminder]\nBijv: /voeg Havermelk 7 2"
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
      `\u2795 <b>${name}</b> toegevoegd!\n\uD83D\uDD01 Herhalend \u00B7 ~${daysUntilEmpty}d voorraad \u00B7 reminder ${remindDaysBefore}d vooraf`
    );
  }

  // /verwijder — product verwijderen
  else if (command.startsWith("/verwijder ") || command.startsWith("/delete ")) {
    const productName = command.replace(/^\/(verwijder|delete)\s+/, "").trim();

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

  // ──────────────────────────────────────
  // TAKEN / HERINNERINGEN
  // ──────────────────────────────────────

  // /taak — taak/herinnering toevoegen
  else if (command.startsWith("/taak ") || command.startsWith("/task ")) {
    const input = command.replace(/^\/(taak|task)\s+/, "").trim();

    if (!input) {
      await sendTelegramMessage(chatId, "Gebruik: /taak <i>omschrijving</i> [datum]\nBijv: /taak Stofzuigen 2025-02-15\nOf gewoon: /taak Banden wisselen");
      return NextResponse.json({ ok: true });
    }

    // Check of er een datum achteraan staat (YYYY-MM-DD of DD-MM-YYYY of DD/MM)
    const datePatterns = [
      /(\d{4}-\d{2}-\d{2})$/,       // 2025-02-15
      /(\d{2}-\d{2}-\d{4})$/,       // 15-02-2025
      /(\d{2}\/\d{2})$/,            // 15/02
    ];

    let title = input;
    let dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7); // default: over 1 week

    for (const pattern of datePatterns) {
      const match = input.match(pattern);
      if (match) {
        title = input.slice(0, match.index).trim();
        const dateStr = match[1];

        if (dateStr.includes("/")) {
          // DD/MM format
          const [day, month] = dateStr.split("/").map(Number);
          dueDate = new Date(new Date().getFullYear(), month - 1, day);
          if (dueDate < new Date()) {
            dueDate.setFullYear(dueDate.getFullYear() + 1);
          }
        } else if (dateStr.length === 10 && dateStr[2] === "-") {
          // DD-MM-YYYY
          const [day, month, year] = dateStr.split("-").map(Number);
          dueDate = new Date(year, month - 1, day);
        } else {
          // YYYY-MM-DD
          dueDate = new Date(dateStr);
        }
        break;
      }
    }

    await supabase.from("reminders").insert({
      household_id: household.id,
      title,
      description: null,
      due_date: dueDate.toISOString(),
      repeat_days: null,
      is_done: false,
    });

    const formattedDate = dueDate.toLocaleDateString("nl-NL", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });

    await sendTelegramMessage(
      chatId,
      `\u2795 Taak aangemaakt:\n\n\uD83D\uDCCB <b>${title}</b>\n\uD83D\uDCC5 ${formattedDate}`
    );
  }

  // /takenlijst — toon alle taken
  else if (command === "/takenlijst" || command === "/taken" || command === "/tasks") {
    const { data: reminders } = await supabase
      .from("reminders")
      .select("*")
      .eq("household_id", household.id)
      .eq("is_done", false)
      .order("due_date", { ascending: true });

    if (!reminders || reminders.length === 0) {
      await sendTelegramMessage(chatId, "\u2705 Geen openstaande taken!");
    } else {
      const today = new Date().toISOString().split("T")[0];
      const lines = reminders.map((r) => {
        const dateStr = r.due_date.split("T")[0];
        const isOverdue = dateStr < today;
        const date = new Date(r.due_date).toLocaleDateString("nl-NL", {
          day: "numeric",
          month: "short",
        });
        const emoji = isOverdue ? "\uD83D\uDD34" : "\uD83D\uDFE2";
        const repeat = r.repeat_days ? ` \uD83D\uDD01${r.repeat_days}d` : "";
        return `${emoji} ${r.title} — ${date}${isOverdue ? " (verlopen!)" : ""}${repeat}`;
      });
      await sendTelegramMessage(
        chatId,
        `\uD83D\uDCCB <b>Taken (${reminders.length}):</b>\n\n${lines.join("\n")}`
      );
    }
  }

  // /klaar — taak afvinken
  else if (command.startsWith("/klaar ") || command.startsWith("/done ")) {
    const taskName = command.replace(/^\/(klaar|done)\s+/, "").trim();

    if (!taskName) {
      await sendTelegramMessage(chatId, "Gebruik: /klaar <i>taaknaam</i>");
      return NextResponse.json({ ok: true });
    }

    const { data: reminders } = await supabase
      .from("reminders")
      .select("*")
      .eq("household_id", household.id)
      .eq("is_done", false)
      .ilike("title", `%${taskName}%`);

    if (!reminders || reminders.length === 0) {
      await sendTelegramMessage(chatId, `\u274C Taak "${taskName}" niet gevonden.`);
    } else {
      const reminder = reminders[0];

      if (reminder.repeat_days) {
        // Herhalend: verplaats datum
        const newDate = new Date(reminder.due_date);
        newDate.setDate(newDate.getDate() + reminder.repeat_days);
        await supabase
          .from("reminders")
          .update({ due_date: newDate.toISOString() })
          .eq("id", reminder.id);

        const formattedDate = newDate.toLocaleDateString("nl-NL", {
          weekday: "short",
          day: "numeric",
          month: "short",
        });
        await sendTelegramMessage(
          chatId,
          `\u2705 <b>${reminder.title}</b> afgerond!\n\uD83D\uDD01 Volgende keer: ${formattedDate}`
        );
      } else {
        // Eenmalig: markeer als done
        await supabase
          .from("reminders")
          .update({ is_done: true })
          .eq("id", reminder.id);
        await sendTelegramMessage(
          chatId,
          `\u2705 <b>${reminder.title}</b> afgerond!`
        );
      }
    }
  }

  // ──────────────────────────────────────
  // HELP
  // ──────────────────────────────────────

  else if (command === "/help" || command === "/start") {
    await sendTelegramMessage(
      chatId,
      [
        "\uD83D\uDED2 <b>Boodschappen Reminder Bot</b>",
        "",
        "\u2500\u2500\u2500 \uD83D\uDCE6 <b>Producten</b> \u2500\u2500\u2500",
        "/nodig \u2014 Wat moet ik kopen?",
        "/producten \u2014 Alle producten + status",
        "/bijna \u2014 Wat is bijna op?",
        "",
        "/snel <i>naam</i> \u2014 Snel op het lijstje",
        "/gekocht <i>naam</i> \u2014 Markeer als gekocht",
        "/voeg <i>naam</i> <i>dagen</i> \u2014 Nieuw product",
        "/verwijder <i>naam</i> \u2014 Product verwijderen",
        "",
        "\u2500\u2500\u2500 \uD83D\uDCCB <b>Taken</b> \u2500\u2500\u2500",
        "/takenlijst \u2014 Alle open taken",
        "/taak <i>naam</i> [datum] \u2014 Nieuwe taak",
        "/klaar <i>naam</i> \u2014 Taak afvinken",
        "",
        "\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
        "\uD83D\uDCA1 <b>Tips:</b>",
        "\u2022 Gedeeltelijke namen werken: <i>/gekocht haver</i> vindt Havermelk",
        "\u2022 /snel maakt een product aan als het nog niet bestaat",
        "\u2022 Datum bij /taak is optioneel (standaard: +7 dagen)",
        "\u2022 Datumformaten: <i>2025-02-15</i>, <i>15-02-2025</i>, of <i>15/02</i>",
      ].join("\n")
    );
  }

  return NextResponse.json({ ok: true });
}
