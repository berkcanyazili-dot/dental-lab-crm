"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DollarSign, PauseCircle, RotateCcw, Building2, TrendingUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface DashboardData {
  kpis: {
    wipDollars: number;
    wipHoldDollars: number;
    remakeDollars: number;
    wipAccountCount: number;
  };
  accountsInLab: {
    id: string;
    name: string;
    doctorName: string | null;
    caseCount: number;
    totalValue: number;
  }[];
  productsInLab: {
    productType: string;
    count: number;
    value: number;
  }[];
}

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
  href,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  sub?: string;
  href?: string;
}) {
  const content = (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-5 flex flex-col gap-3 transition-colors hover:bg-gray-800 hover:border-gray-600">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400 font-medium">{label}</span>
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );

  if (!href) return content;

  return (
    <Link href={href} className="block">
      {content}
    </Link>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500" />
      </div>
    );
  }

  const kpis = data?.kpis ?? {
    wipDollars: 0,
    wipHoldDollars: 0,
    remakeDollars: 0,
    wipAccountCount: 0,
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-400 mt-1">Lab overview and key metrics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="WIP Dollars"
          value={formatCurrency(kpis.wipDollars)}
          icon={DollarSign}
          color="bg-sky-500/20 text-sky-400"
          sub="Cases in work in progress"
          href="/wip"
        />
        <KpiCard
          label="WIP Hold"
          value={formatCurrency(kpis.wipHoldDollars)}
          icon={PauseCircle}
          color="bg-orange-500/20 text-orange-400"
          sub="Cases on hold"
          href="/hold"
        />
        <KpiCard
          label="Remake Dollars"
          value={formatCurrency(kpis.remakeDollars)}
          icon={RotateCcw}
          color="bg-red-500/20 text-red-400"
          sub="Cases being remade"
          href="/remakes"
        />
        <KpiCard
          label="WIP Accounts"
          value={String(kpis.wipAccountCount)}
          icon={Building2}
          color="bg-purple-500/20 text-purple-400"
          sub="Active accounts in lab"
          href="/accounts"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-700/50">
            <Building2 className="w-4 h-4 text-sky-400" />
            <h2 className="font-semibold text-white">Accounts in Lab</h2>
            <span className="ml-auto text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
              {data?.accountsInLab.length ?? 0}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Account</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Cases</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {!data?.accountsInLab.length ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-gray-500 text-sm">
                      No active accounts in lab
                    </td>
                  </tr>
                ) : (
                  data.accountsInLab.map((acc) => (
                    <tr key={acc.id} className="hover:bg-gray-700/20 transition-colors">
                      <td className="px-5 py-3">
                        <Link
                          href={`/wip?search=${encodeURIComponent(acc.name)}`}
                          className="font-medium text-white hover:text-sky-300"
                        >
                          {acc.name}
                        </Link>
                        {acc.doctorName && <p className="text-xs text-gray-500">Dr. {acc.doctorName}</p>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 text-xs font-bold">
                          {acc.caseCount}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right font-medium text-green-400">
                        {formatCurrency(acc.totalValue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-gray-800/60 border border-gray-700/50 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-700/50">
            <TrendingUp className="w-4 h-4 text-sky-400" />
            <h2 className="font-semibold text-white">Products in Lab</h2>
            <span className="ml-auto text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
              {data?.productsInLab.length ?? 0} types
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Product</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Units</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {!data?.productsInLab.length ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-gray-500 text-sm">
                      No products currently in lab
                    </td>
                  </tr>
                ) : (
                  data.productsInLab
                    .sort((a, b) => b.count - a.count)
                    .map((prod) => (
                      <tr key={prod.productType} className="hover:bg-gray-700/20 transition-colors">
                        <td className="px-5 py-3 font-medium text-white">
                          <Link
                            href={`/cases-in-lab?search=${encodeURIComponent(prod.productType)}`}
                            className="hover:text-sky-300"
                          >
                            {prod.productType}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold">
                            {prod.count}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right font-medium text-green-400">
                          {formatCurrency(prod.value)}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
