import type { z } from "zod";
import type { endOfCallReportSchema } from "./validation";

export type EndOfCallReport = z.infer<typeof endOfCallReportSchema>;
export type CallData = {
  vapiCallId: string;
  callerNumber?: string;
  status?: string;
  startedAt?: Date;
  endedAt?: Date;
  durationSeconds?: number;
  transcript?: string;
  summary?: string;
  endReason?: string;
};

export type SaveCall = (data: CallData) => Promise<void>;
