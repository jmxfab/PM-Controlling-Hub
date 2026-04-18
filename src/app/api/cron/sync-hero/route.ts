import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

function createReadOnlyResponse() {
  return NextResponse.json(
    {
      success: false,
      error:
        "Dieses Dashboard läuft im Read-only-Modus. Schreib- und Sync-Funktionen sind dauerhaft deaktiviert.",
    },
    { status: 410 }
  );
}

export async function GET(_request: NextRequest) {
  return createReadOnlyResponse();
}

export async function POST() {
  return createReadOnlyResponse();
}
