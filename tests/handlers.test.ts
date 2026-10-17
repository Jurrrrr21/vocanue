import { expect, it } from "vitest";
import { endOfCallReportSchema } from "@/lib/vapi/validation";
import { extractCallData } from "@/lib/vapi/handlers";

it("supports documented nested call fields when report fields are missing", () => {
  const report = endOfCallReportSchema.parse({
    type: "end-of-call-report",
    call: { id: "nested", startedAt: "2026-10-17T11:00:00+11:00", endedAt: "2026-10-17T11:00:00+11:00",
      artifact: { transcript: "User: Hello" }, analysis: { summary: "Greeting" }, endedReason: "customer-ended-call" },
  });
  expect(extractCallData(report)).toEqual({ vapiCallId: "nested", startedAt: new Date("2026-10-17T00:00:00Z"),
    endedAt: new Date("2026-10-17T00:00:00Z"), durationSeconds: 0, transcript: "User: Hello", summary: "Greeting", endReason: "customer-ended-call" });
});

it("prefers the report customer and leaves partial duration unknown", () => {
  const report = endOfCallReportSchema.parse({ type: "end-of-call-report", customer: { number: "+61400000001" },
    call: { id: "partial", customer: { number: "+61400000000" }, startedAt: "2026-10-17T00:00:00Z" } });
  const data = extractCallData(report);
  expect(data.callerNumber).toBe("+61400000001");
  expect(data).not.toHaveProperty("durationSeconds");
  expect(data).not.toHaveProperty("endedAt");
});
