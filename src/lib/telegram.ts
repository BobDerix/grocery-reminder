const TELEGRAM_API = "https://api.telegram.org/bot";

export async function sendTelegramMessage(
  chatId: string,
  text: string
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN is not set");
    return false;
  }

  const res = await fetch(`${TELEGRAM_API}${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Telegram API error:", err);
    return false;
  }

  return true;
}
