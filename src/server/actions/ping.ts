"use server";

import type { PingActionInput } from "@/schemas/ping-action";
import { buildPingResponse } from "@/server/services/ping";

export async function pingAction(input: PingActionInput) {
  return buildPingResponse(input);
}
