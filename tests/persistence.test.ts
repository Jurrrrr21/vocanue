import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { upsert } = vi.hoisted(() => ({ upsert: vi.fn().mockResolvedValue({}) }));
vi.mock("@/lib/db", () => ({ getDb: () => ({ call: { upsert } }) }));
import { saveCall } from "@/lib/vapi/persistence";

it("uses the unique Vapi ID for an atomic upsert on every delivery", async () => {
  await saveCall({ vapiCallId: "duplicate", summary: "Useful summary" });
  await saveCall({ vapiCallId: "duplicate" });
  expect(upsert).toHaveBeenNthCalledWith(1, {
    where: { vapiCallId: "duplicate" },
    create: { vapiCallId: "duplicate", summary: "Useful summary" },
    update: { vapiCallId: "duplicate", summary: "Useful summary" },
  });
  expect(upsert).toHaveBeenNthCalledWith(2, {
    where: { vapiCallId: "duplicate" }, create: { vapiCallId: "duplicate" }, update: { vapiCallId: "duplicate" },
  });
});
