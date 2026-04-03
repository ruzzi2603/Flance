import { NextResponse } from "next/server";
import { getApiHealth } from "../../../services/api";

export async function GET() {
  try {
    const data = await getApiHealth();
    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: "Backend indisponivel",
          code: "BACKEND_UNAVAILABLE",
        },
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}

