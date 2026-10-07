import { NextResponse } from "next/server";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const response = await fetch(`${API_BASE_URL}/v1/conversations`, {
    credentials: "include",
    headers: {
      Cookie: _request.headers.get("cookie") ?? "",
    },
  });

  if (!response.ok) {
    return NextResponse.json({ participants: {} }, { status: response.status });
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: Array<{
      id: string;
      company: { id: string; name: string; location?: string | null };
      client: { id: string; name: string; avatarUrl?: string | null };
      freelancer: { id: string; name: string; avatarUrl?: string | null };
    }>;
  };

  const conversation = payload.data.find((item) => item.id === params.id);
  if (!conversation) {
    return NextResponse.json({ participants: {} }, { status: 404 });
  }

  return NextResponse.json({
    participants: {
      [conversation.client.id]: conversation.client.name,
      [conversation.freelancer.id]: conversation.freelancer.name,
    },
    conversation: {
      id: conversation.id,
      company: conversation.company,
      client: {
        id: conversation.client.id,
        name: conversation.client.name,
        avatarUrl: conversation.client.avatarUrl ?? undefined,
      },
      freelancer: {
        id: conversation.freelancer.id,
        name: conversation.freelancer.name,
        avatarUrl: conversation.freelancer.avatarUrl ?? undefined,
      },
    },
  });
}
