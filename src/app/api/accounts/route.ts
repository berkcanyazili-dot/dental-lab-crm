import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const createAccountSchema = z
  .object({
    name: z.string().trim().min(1),
    doctorName: z.string().trim().min(1).optional().nullable(),
    email: z.string().trim().email().optional().nullable(),
    phone: z.string().trim().min(1).optional().nullable(),
    fax: z.string().trim().min(1).optional().nullable(),
    address: z.string().trim().min(1).optional().nullable(),
    city: z.string().trim().min(1).optional().nullable(),
    state: z.string().trim().min(1).optional().nullable(),
    zip: z.string().trim().min(1).optional().nullable(),
    notes: z.string().trim().min(1).optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .strict();

export async function GET() {
  try {
    const accounts = await prisma.dentalAccount.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { cases: true } } },
    });
    return NextResponse.json(accounts);
  } catch {
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const parsed = createAccountSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid account payload", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const account = await prisma.dentalAccount.create({ data: parsed.data });
    return NextResponse.json(account, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}
