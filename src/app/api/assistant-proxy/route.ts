import { executeAssistantInternalProxyRequest } from "@/server/legal-assistant/internal-proxy";

export async function POST(request: Request) {
  const authorizationHeader = request.headers.get("authorization") ?? "";
  const bearerToken = authorizationHeader.replace(/^Bearer\s+/i, "").trim();
  const payload = (await request.json().catch(() => null)) as
    | {
        model?: string;
        temperature?: number;
        messages?: Array<{
          role?: "system" | "user" | "assistant";
          content?: string;
        }>;
        metadata?: Record<string, unknown> | null;
      }
    | null;

  if (!payload?.model || !Array.isArray(payload.messages) || payload.messages.length === 0) {
    return Response.json(
      {
        error: {
          message: "Некорректный payload internal assistant proxy.",
        },
      },
      {
        status: 400,
      },
    );
  }

  const result = await executeAssistantInternalProxyRequest({
    bearerToken,
    payload: {
      model: payload.model,
      temperature: payload.temperature,
      messages: payload.messages
        .filter((message) => Boolean(message?.role && message?.content))
        .map((message) => ({
          role: message.role as "system" | "user" | "assistant",
          content: String(message.content),
        })),
      metadata: payload.metadata ?? null,
    },
  });

  return Response.json(result.payload, {
    status: result.status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
