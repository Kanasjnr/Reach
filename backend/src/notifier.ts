import webpush from "web-push";
import { config } from "./config.js";
import { getPushSubscription } from "./db.js";

webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);

export async function notifyReceiver(address: string, netAmount: string, token: string) {
  const subscription = getPushSubscription(address);
  if (!subscription) return; // hasn't subscribed to push yet, nothing to notify

  const payload = JSON.stringify({
    title: "Funds arrived",
    body: `${netAmount} of ${token} just landed in your wallet`,
  });

  try {
    await webpush.sendNotification(subscription, payload);
  } catch (err) {
    console.error("push notification failed", address, err);
  }
}
