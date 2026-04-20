import { pingActionSchema, type PingActionInput } from "@/schemas/ping-action";

export function buildPingResponse(input: PingActionInput) {
  const parsed = pingActionSchema.parse(input);

  return {
    ok: true,
    echoedMessage: parsed.message,
    processedAt: new Date().toISOString(),
  };
}
