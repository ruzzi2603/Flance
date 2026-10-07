import { NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const response = await fetch(`${API_BASE_URL}/v1/conversations/${params.id}/proposal`, {
    credentials: "include",
    headers: {
      Cookie: request.headers.get("cookie") ?? "",
    },
  });

  if (!response.ok) {
    return NextResponse.json({ proposal: null }, { status: response.status });
  }

  const payload = (await response.json()) as {
    success: boolean;
    data: {
      id: string;
      status: "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";
      bidAmount: number;
      text: string;
      job: { id: string; title: string };
      clientId: string;
      freelancerId: string;
    } | null;
  };

  return NextResponse.json({ proposal: payload.data });
}
