import { NextRequest, NextResponse } from "next/server";
import { importShopifyOrderAsCase } from "@/server/services/shopifyImport";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => ({}));
  const { dentalAccountId, overrides } = body as {
    dentalAccountId: string;
    overrides?: Record<string, unknown>;
  };

  if (!dentalAccountId) {
    return NextResponse.json(
      { error: "dentalAccountId is required" },
      { status: 400 }
    );
  }

  try {
    const newCase = await importShopifyOrderAsCase(params.id, dentalAccountId, overrides ?? {});
    if (!newCase) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json(newCase, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 400 });
  }
}
