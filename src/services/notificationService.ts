import emailjs from "@emailjs/browser";

export async function sendSystemEmail(payload: {
  type: "approval" | "rejection" | "deposit" | "withdrawal";
  to: string;
  name?: string;
  accountId?: string;
  loginEmail?: string;
  originalPassword?: string;
  reason?: string;
  amount?: number;
  status?: string;
}) {
  const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID;
  const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY;
  const fromName = process.env.NEXT_PUBLIC_EMAILJS_FROM_NAME?.trim() || "TradeFX Support";
  const replyTo = process.env.NEXT_PUBLIC_EMAILJS_REPLY_TO?.trim() || "";

  if (!serviceId || !templateId || !publicKey) {
    return { ok: false as const, error: "EmailJS is not configured" };
  }

  if (typeof window === "undefined") {
    return { ok: false as const, error: "EmailJS can only run in browser context" };
  }

  const name = payload.name?.trim() || "Trader";
  const username = payload.loginEmail?.trim() || payload.to;

  let password = payload.originalPassword?.trim() || "";
  if (payload.type === "rejection") {
    password = payload.reason?.trim() || "KYC rejected";
  }

  if (payload.type === "deposit") {
    const amount = Number(payload.amount ?? 0).toFixed(2);
    password = `Deposit ${String(payload.status ?? "updated").toUpperCase()} | Amount: $${amount}`;
  }

  if (payload.type === "withdrawal") {
    const amount = Number(payload.amount ?? 0).toFixed(2);
    password = `Withdrawal ${String(payload.status ?? "updated").toUpperCase()} | Amount: $${amount}`;
  }

  try {
    await emailjs.send(
      serviceId,
      templateId,
      {
        from_name: fromName,
        reply_to: replyTo,
        app_name: "TradeFX",
        name,
        username,
        password,
        to_email: payload.to,
      },
      { publicKey },
    );

    return { ok: true as const };
  } catch (error) {
    console.error("[EmailJS] Failed to send email", { type: payload.type, error });
    return { ok: false as const, error: "EmailJS send failed" };
  }
}
