import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [wipCases, holdCases, remakeCases, accounts, allWipItems] =
      await Promise.all([
        prisma.case.findMany({
          where: { status: { in: ["WIP", "IN_LAB"] } },
          include: { dentalAccount: true, items: true },
        }),
        prisma.case.findMany({
          where: { status: "HOLD" },
          include: { dentalAccount: true, items: true },
        }),
        prisma.case.findMany({
          where: { status: "REMAKE" },
          include: { dentalAccount: true, items: true },
        }),
        prisma.dentalAccount.findMany({
          where: { isActive: true },
          include: {
            cases: {
              where: { status: { in: ["INCOMING", "IN_LAB", "WIP", "HOLD"] } },
              include: { items: true },
            },
          },
        }),
        prisma.caseItem.findMany({
          where: {
            case: { status: { in: ["WIP", "IN_LAB", "INCOMING"] } },
          },
        }),
      ]);

    const wipDollars = wipCases.reduce((sum, c) => sum + c.totalValue, 0);
    const holdDollars = holdCases.reduce((sum, c) => sum + c.totalValue, 0);
    const remakeDollars = remakeCases.reduce((sum, c) => sum + c.totalValue, 0);

    const accountsInLab = accounts
      .filter((a) => a.cases.length > 0)
      .map((a) => ({
        id: a.id,
        name: a.name,
        doctorName: a.doctorName,
        caseCount: a.cases.length,
        totalValue: a.cases.reduce((sum, c) => sum + c.totalValue, 0),
      }));

    const productCounts: Record<string, { count: number; value: number }> = {};
    allWipItems.forEach((item) => {
      if (!productCounts[item.productType]) {
        productCounts[item.productType] = { count: 0, value: 0 };
      }
      productCounts[item.productType].count += item.units;
      productCounts[item.productType].value += item.price * item.units;
    });

    const productsInLab = Object.entries(productCounts).map(([type, data]) => ({
      productType: type,
      count: data.count,
      value: data.value,
    }));

    return NextResponse.json({
      kpis: {
        wipDollars,
        wipHoldDollars: holdDollars,
        remakeDollars,
        wipAccountCount: accountsInLab.length,
      },
      accountsInLab,
      productsInLab,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch dashboard data" }, { status: 500 });
  }
}
