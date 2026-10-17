import type { EndOfCallReport } from "./types";

type Artifact = NonNullable<EndOfCallReport["artifact"]>;
type Message = NonNullable<Artifact["messages"]>[number];

function formatMessages(messages: Message[] | null | undefined): string | undefined {
  const lines = (messages ?? []).flatMap((message) => {
    const label = message.role === "user" ? "Customer"
      : message.role === "assistant" || message.role === "bot" ? "Assistant" : undefined;
    if (!label) return [];
    const content = typeof message.content === "string" ? message.content
      : message.content?.filter((part) => part.type === "text").map((part) => part.text ?? "").join(" ");
    const text = message.message?.trim() || content?.trim();
    return text ? [`${label}: ${text}`] : [];
  });
  return lines.length ? lines.join("\n\n") : undefined;
}

export function formatTranscript(artifact: Artifact | null | undefined): string | undefined {
  return formatMessages(artifact?.messages)
    ?? formatMessages(artifact?.messagesOpenAIFormatted)
    // Keep provider text intact when structured speaker information is unavailable.
    ?? (artifact?.transcript?.trim() || undefined);
}
