import { NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await fetch(`${API_BASE_URL}/v1/auth/password/forgot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(70_000),
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return NextResponse.json(
      {
        success: false,
        error: {
          code: timedOut ? "API_TIMEOUT" : "API_UNAVAILABLE",
          message: timedOut
            ? "A solicitação demorou mais que o esperado. Tente novamente."
            : "Não foi possível conectar à API. Tente novamente em instantes.",
        },
      },
      { status: timedOut ? 504 : 503 },
    );
  }
}
