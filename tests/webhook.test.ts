import { describe, expect, it, vi } from "vitest";
import { createWebhookHandler } from "@/lib/vapi/webhook";
import type { CallData } from "@/lib/vapi/types";
import { reportFixture } from "./fixtures";

const token = "test-only-token-with-at-least-32-characters";
function request(payload: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/vapi/webhook", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...headers },
    body: JSON.stringify(payload),
  });
}
function setup() {
  const saveCall = vi.fn<(data: CallData) => Promise<void>>().mockResolvedValue(undefined);
  const logError = vi.fn();
  const handler = createWebhookHandler({ getToken: () => token, saveCall, logError });
  return { handler, saveCall, logError };
}

describe("Vapi webhook", () => {
  it("saves a valid report with normalized dates, duration and speaker labels", async () => {
    const { handler, saveCall } = setup();
    expect((await handler(request(reportFixture()))).status).toBe(200);
    expect(saveCall).toHaveBeenCalledWith({
      vapiCallId: "synthetic-call-001", callerNumber: "+61400000000", status: "ended",
      startedAt: new Date("2026-10-17T00:00:00Z"), endedAt: new Date("2026-10-17T00:01:30.250Z"),
      durationSeconds: 90.25, transcript: "Customer: My drain is blocked.\n\nAssistant: Is it draining slowly?",
      summary: "Customer reported a blocked drain.", endReason: "customer-ended-call",
    });
  });

  it.each([{}, { message: {} }, { message: { type: "end-of-call-report", call: {} } },
    { message: { type: "end-of-call-report", call: { id: "x" }, startedAt: "yesterday" } },
  ])("rejects an invalid payload", async (payload) => {
    const { handler, saveCall } = setup();
    expect((await handler(request(payload))).status).toBe(400);
    expect(saveCall).not.toHaveBeenCalled();
  });

  it("handles missing optional fields without inventing values", async () => {
    const { handler, saveCall } = setup();
    expect((await handler(request({ message: { type: "end-of-call-report", call: { id: "minimal" } } }))).status).toBe(200);
    expect(saveCall).toHaveBeenCalledWith({ vapiCallId: "minimal" });
  });

  it("preserves useful fields on a sparse duplicate delivery", async () => {
    const records = new Map<string, CallData>();
    const handler = createWebhookHandler({ getToken: () => token, saveCall: async (data) => {
      records.set(data.vapiCallId, { ...records.get(data.vapiCallId), ...data });
    } });
    await handler(request(reportFixture()));
    await handler(request(reportFixture()));
    await handler(request({ message: { type: "end-of-call-report", call: { id: "synthetic-call-001" }, artifact: { transcript: " " }, analysis: { summary: "" } } }));
    expect(records.size).toBe(1);
    expect(records.get("synthetic-call-001")?.summary).toBe("Customer reported a blocked drain.");
    expect(records.get("synthetic-call-001")?.transcript).toContain("Customer:");
  });

  it("ignores other event bodies without applying call report requirements", async () => {
    const { handler, saveCall } = setup();
    const response = await handler(request({ message: { type: "speech-update", role: "user", status: "stopped" } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, ignored: true });
    expect(saveCall).not.toHaveBeenCalled();
  });

  it("accepts an empty transcript", async () => {
    const { handler, saveCall } = setup();
    await handler(request({ message: { type: "end-of-call-report", call: { id: "empty" }, artifact: { messages: [], transcript: " " } } }));
    expect(saveCall).toHaveBeenCalledWith({ vapiCallId: "empty" });
  });

  it("returns a retryable failure without exposing database errors", async () => {
    const { handler, saveCall, logError } = setup();
    saveCall.mockRejectedValue(new Error("secret database connection string"));
    const response = await handler(request(reportFixture()));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret");
    expect(logError).toHaveBeenCalledWith("call_persistence_failed");
  });

  it.each(["", "Bearer wrong-token", `Basic ${token}`])("rejects unauthenticated requests", async (authorization) => {
    const { handler, saveCall } = setup();
    expect((await handler(request(reportFixture(), { authorization }))).status).toBe(401);
    expect(saveCall).not.toHaveBeenCalled();
  });

  it("fails closed when the token is not configured", async () => {
    const saveCall = vi.fn();
    const handler = createWebhookHandler({ getToken: () => undefined, saveCall });
    expect((await handler(request(reportFixture()))).status).toBe(503);
    expect(saveCall).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON", async () => {
    const { handler } = setup();
    const req = new Request("http://localhost", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: "{" });
    expect((await handler(req)).status).toBe(400);
  });

  it("rejects unsupported media types", async () => {
    const { handler } = setup();
    expect((await handler(request({}, { "content-type": "text/plain" }))).status).toBe(415);
  });

  it("enforces the body limit even without content-length", async () => {
    const { handler, saveCall } = setup();
    expect((await handler(request({ data: "x".repeat(2 * 1024 * 1024) }))).status).toBe(413);
    expect(saveCall).not.toHaveBeenCalled();
  });

  it("rejects inverted timestamps", async () => {
    const { handler } = setup();
    const payload = reportFixture();
    payload.message.endedAt = "2026-10-16T00:00:00Z";
    expect((await handler(request(payload))).status).toBe(400);
  });
});
