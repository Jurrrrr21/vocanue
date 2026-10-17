import { z } from "zod";

const optionalText = (max: number) => z.string().max(max).nullish();
const timestamp = z.iso.datetime({ offset: true }).nullish();
const conversationMessage = z.object({
  role: z.string().max(64),
  message: optionalText(500_000),
  content: z.union([
    z.string().max(500_000),
    z.array(z.object({ type: z.string(), text: optionalText(500_000) })).max(10_000),
  ]).nullish(),
});
const artifact = z.object({
  transcript: optionalText(1_000_000),
  messages: z.array(conversationMessage).max(20_000).nullish(),
  messagesOpenAIFormatted: z.array(conversationMessage).max(20_000).nullish(),
});
const analysis = z.object({ summary: optionalText(100_000) });

// Validate only the envelope for events we do not consume; their bodies differ.
export const envelopeSchema = z.object({
  message: z.object({ type: z.string().trim().min(1).max(128) }).passthrough(),
});

export const endOfCallReportSchema = z.object({
  type: z.literal("end-of-call-report"),
  call: z.object({
    id: z.string().trim().min(1).max(255),
    customer: z.object({ number: optionalText(64) }).nullish(),
    status: optionalText(64),
    startedAt: timestamp,
    endedAt: timestamp,
    endedReason: optionalText(255),
    artifact: artifact.nullish(),
    analysis: analysis.nullish(),
  }),
  startedAt: timestamp,
  endedAt: timestamp,
  customer: z.object({ number: optionalText(64) }).nullish(),
  endedReason: optionalText(255),
  artifact: artifact.nullish(),
  analysis: analysis.nullish(),
}).superRefine((report, context) => {
  const start = report.startedAt ?? report.call.startedAt;
  const end = report.endedAt ?? report.call.endedAt;
  if (start && end && Date.parse(end) < Date.parse(start)) {
    context.addIssue({ code: "custom", message: "End precedes start", path: ["endedAt"] });
  }
});
