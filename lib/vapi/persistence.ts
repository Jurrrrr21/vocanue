import "server-only";
import { getDb } from "@/lib/db";
import type { CallData } from "./types";

export async function saveCall(data: CallData): Promise<void> {
  const { vapiCallId, ...fields } = data;
  // A single native PostgreSQL upsert also handles concurrent duplicate deliveries.
  await getDb().call.upsert({
    where: { vapiCallId },
    create: data,
    update: { vapiCallId, ...fields },
  });
}
