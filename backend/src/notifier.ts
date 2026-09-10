import { getEmailForWallet } from "./db.js";

const RESEND_API_KEY = process.env.RESEND_API_KEY;

export async function notifyReceiver(address: string, netAmount: string, token: string) {
  const email = getEmailForWallet(address);
  if (!email) return; // receiver hasn't linked an email yet, nothing to notify

  if (!RESEND_API_KEY) {
    console.log(`[notify] would email ${email}: funds arrived (${netAmount} of ${token})`);
    return;
  }

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.NOTIFY_FROM_EMAIL ?? "reach@example.com",
      to: email,
      subject: "Funds arrived",
      text: `Your Reach balance just went up. Log in to see it.`,
    }),
  });
}
