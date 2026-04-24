"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import { PRODUCT_TYPES } from "@/lib/constants";
import { TrendingUp, BarChart3 } from "lucide-react";

interface SalesSummary {
  productType: string;
  totalUnits: number;
  totalRevenue: number;
  caseCount: number;
}

interface AccountSales {
  id: string;
  name: string;
  doctorName: string | null;
  totalCases: number;
  totalRevenue: number;
  paidRevenue: number;
}

export default function SalesPage() {
  const [productSales, setProductSales] = useState<SalesSummary[]>([]);
  const [accountSales, setAccountSales] = useState<AccountSales[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/cases").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
    ]).then(([cases, accounts]: [
      { items: { productType: string; units: number; price: number }[]; totalValue: number; isPaid: boolean; dentalAccountId: string }[],
      { id: string; name: string; doctorName: string | null }[]
    ]) => {
      const pMap: Record<string, SalesSummary> = {};
      cases.forEach((c) => {
        c.items?.forEach((item) => {
          if (!pMap[item.productType]) {
            pMap[item.productType] = { productType: item.productType, totalUnits: 0, totalRevenue: 0, caseCount: 0 };
          }
          pMap[item.productType].totalUnits += item.units;
          pMap[item.productType].totalRevenue += item.price * item.units;
          pMap[item.productType].caseCount += 1;
        });
      });
      setProductSales(Object.values(pMap).sort((a, b) => b.totalRevenue - a.totalRevenue));

      const aMap: Record<string, AccountSales> = {};
      accounts.forEach((a) => {
        aMap[a.id] = { id: a.id, name: a.name, doctorName: a.doctorName, totalCases: 0, totalRevenue: 0, paidRevenue: 0 };
      });
      cases.forEach((c) => {
        if (aMap[c.dentalAccountId]) {
          aMap[c.dentalAccountId].totalCases += 1;
          aMap[c.dentalAccountId].totalRevenue += c.totalValue;
          if (c.isPaid) aMap[c.dentalAccountId].paidRevenue += c.totalValue;
        }
      });
      setAccountSales(Object.values(aMap).filter((a) => a.totalCases > 0).sort((a, b) => b.totalRevenue - a.totalRevenue));
      setLoading(false);
    });
  }, []);

  const totalRevenue = productSales.reduce((s, p) => s + p.totalRevenue, 0);
  const maxRevenue = Math.max(...productSales.map((p) => p.totalRevenue), 1);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Sales Departments</h1>
        <p className="text-sm text-gray-400 mt-1">Revenue breakdown by product and account</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-700/50">
              <BarChart3 className="w-4 h-4 text-sky-400" />
              <h2 className="font-semibold text-white">Revenue by Product</h2>
              <span className="ml-auto text-xs text-gray-500">{formatCurrency(totalRevenue)} total</span>
            </div>
            <div className="p-4 space-y-3">
              {productSales.length === 0 ? (
                <p className="text-center text-gray-500 py-8 text-sm">No sales data yet</p>
              ) : (
                productSales.map((p) => (
                  <div key={p.productType}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-300">{p.productType}</span>
                      <span className="text-sm font-medium text-white">{formatCurrency(p.totalRevenue)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full"
                        style={{ width: `${(p.totalRevenue / maxRevenue) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{p.totalUnits} units · {p.caseCount} cases</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-700/50">
              <TrendingUp className="w-4 h-4 text-sky-400" />
              <h2 className="font-semibold text-white">Revenue by Account</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700/50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Account</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Cases</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/30">
                  {accountSales.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-gray-500">No data yet</td>
                    </tr>
                  ) : (
                    accountSales.map((a) => (
                      <tr key={a.id} className="hover:bg-gray-700/20 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-medium text-white">{a.name}</p>
                          {a.doctorName && <p className="text-xs text-gray-500">Dr. {a.doctorName}</p>}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-400">{a.totalCases}</td>
                        <td className="px-5 py-3 text-right font-bold text-green-400">{formatCurrency(a.totalRevenue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-700/50">
          <h2 className="font-semibold text-white">All Products</h2>
          <p className="text-xs text-gray-500 mt-0.5">Complete lab product catalog</p>
        </div>
        <div className="p-4 flex flex-wrap gap-2">
          {PRODUCT_TYPES.map((p) => (
            <span key={p} className="px-3 py-1.5 bg-gray-700/60 border border-gray-600/50 text-gray-300 text-sm rounded-lg">
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
