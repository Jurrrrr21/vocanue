import type { CallData, EndOfCallReport, SaveCall } from "./types";
import { formatTranscript } from "./transcript";

export function extractCallData(report: EndOfCallReport): CallData {
  const start = report.startedAt ?? report.call.startedAt;
  const end = report.endedAt ?? report.call.endedAt;
  const startedAt = start ? new Date(start) : undefined;
  const endedAt = end ? new Date(end) : undefined;
  const data: CallData = {
    vapiCallId: report.call.id,
    callerNumber: report.customer?.number?.trim() || report.call.customer?.number?.trim() || undefined,
    status: report.call.status?.trim() || undefined,
    startedAt,
    endedAt,
    durationSeconds: startedAt && endedAt
      ? (endedAt.getTime() - startedAt.getTime()) / 1000 : undefined,
    transcript: formatTranscript(report.artifact) ?? formatTranscript(report.call.artifact),
    summary: report.analysis?.summary?.trim() || report.call.analysis?.summary?.trim() || undefined,
    endReason: report.endedReason?.trim() || report.call.endedReason?.trim() || undefined,
  };
  // Omit absent fields from the update, preserving earlier useful information.
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as CallData;
}

export async function handleEndOfCallReport(report: EndOfCallReport, saveCall: SaveCall): Promise<void> {
  await saveCall(extractCallData(report));
}
