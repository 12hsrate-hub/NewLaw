import { getHealthPayload } from "@/server/http/health";

export async function GET() {
  const payload = getHealthPayload();

  return Response.json(payload, {
    status: 200,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
