import { expect, it } from "vitest";
import { formatTranscript } from "@/lib/vapi/transcript";

it("handles absent and empty artifacts", () => {
  expect(formatTranscript(undefined)).toBeUndefined();
  expect(formatTranscript({ messages: [] })).toBeUndefined();
});
it("supports OpenAI formatted content and skips tool messages", () => {
  expect(formatTranscript({ messagesOpenAIFormatted: [
    { role: "tool", content: "internal result" },
    { role: "user", content: [{ type: "text", text: "Hello" }] },
    { role: "assistant", content: "How can I help?" },
  ] })).toBe("Customer: Hello\n\nAssistant: How can I help?");
});
it("retains plain transcript fallback without guessing speakers", () => {
  expect(formatTranscript({ transcript: " AI: Hello\nUser: Hi " })).toBe("AI: Hello\nUser: Hi");
});
