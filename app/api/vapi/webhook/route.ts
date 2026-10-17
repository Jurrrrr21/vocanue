import { saveCall } from "@/lib/vapi/persistence";
import { createWebhookHandler } from "@/lib/vapi/webhook";

export const runtime = "nodejs";
export const maxDuration = 30;

export const POST = createWebhookHandler({
  getToken: () => process.env.VAPI_WEBHOOK_TOKEN,
  saveCall,
  logError: (code) => console.error(`[vocanue] ${code}`),
});
