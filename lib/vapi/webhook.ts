import { createHash, timingSafeEqual } from "node:crypto";
import { envelopeSchema, endOfCallReportSchema } from "./validation";
import { handleEndOfCallReport } from "./handlers";
import type { SaveCall } from "./types";

const MAX_BODY_BYTES = 2 * 1024 * 1024;
class BodyTooLarge extends Error {}

async function readJson(request: Request): Promise<unknown> {
  const declaredLength = request.headers.get("content-length");
  if (declaredLength && Number(declaredLength) > MAX_BODY_BYTES) throw new BodyTooLarge();
  if (!request.body) throw new SyntaxError();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new BodyTooLarge();
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(body: object, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export function createWebhookHandler(dependencies: {
  getToken: () => string | undefined;
  saveCall: SaveCall;
  logError?: (code: string) => void;
}) {
  return async function POST(request: Request): Promise<Response> {
    const token = dependencies.getToken();
    if (!token || token.length < 32 || token.startsWith("replace-")) {
      dependencies.logError?.("webhook_configuration_missing");
      return json({ error: "Service unavailable" }, 503);
    }
    const authorization = request.headers.get("authorization") ?? "";
    const match = /^Bearer (\S+)$/i.exec(authorization);
    const hash = (value: string) => createHash("sha256").update(value).digest();
    if (!match || !timingSafeEqual(hash(match[1]), hash(token))) {
      return json({ error: "Unauthorized" }, 401);
    }
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      return json({ error: "Expected application/json" }, 415);
    }
    let payload: unknown;
    try { payload = await readJson(request); }
    catch (error) {
      return error instanceof BodyTooLarge
        ? json({ error: "Payload too large" }, 413)
        : json({ error: "Invalid JSON" }, 400);
    }
    const envelope = envelopeSchema.safeParse(payload);
    if (!envelope.success) return json({ error: "Invalid event envelope" }, 400);
    if (envelope.data.message.type !== "end-of-call-report") {
      return json({ received: true, ignored: true });
    }
    const report = endOfCallReportSchema.safeParse(envelope.data.message);
    if (!report.success) return json({ error: "Invalid call report" }, 400);
    try {
      await handleEndOfCallReport(report.data, dependencies.saveCall);
      return json({ received: true });
    } catch {
      // Never log the payload, phone number, token, transcript, or raw database error.
      dependencies.logError?.("call_persistence_failed");
      return json({ error: "Unable to save call" }, 503);
    }
  };
}
