import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch("https://ipapi.co/json/", {
      headers: {
        "user-agent": "flance-geo",
      },
      next: { revalidate: 3600 },
    });
    if (!response.ok) {
      return NextResponse.json({ countryCode: null, currency: null }, { status: 200 });
    }
    const data = (await response.json()) as { country_code?: string; currency?: string };
    return NextResponse.json(
      {
        countryCode: data.country_code ?? null,
        currency: data.currency ?? null,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json({ countryCode: null, currency: null }, { status: 200 });
  }
}
