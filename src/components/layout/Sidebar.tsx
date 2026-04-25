"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ArrowDownToLine,
  ArrowUpFromLine,
  RotateCcw,
  FlaskConical,
  PauseCircle,
  Clock,
  Wrench,
  DollarSign,
  BarChart3,
  FileBarChart,
  Users,
  ClipboardCheck,
  Building2,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/incoming", label: "Incoming", icon: ArrowDownToLine },
  { href: "/outgoing", label: "Outgoing", icon: ArrowUpFromLine },
  { href: "/remakes", label: "Remakes", icon: RotateCcw },
  { href: "/cases-in-lab", label: "Cases In Lab", icon: FlaskConical },
  { href: "/hold", label: "Hold Cases", icon: PauseCircle },
  { href: "/history", label: "Case History", icon: Clock },
  { href: "/wip", label: "Work In Progress", icon: Wrench },
  { href: "/billing", label: "Billing", icon: DollarSign },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/sales", label: "Sales Departments", icon: BarChart3 },
  { href: "/technicians", label: "Technicians", icon: Users },
  { href: "/technicians/checkin", label: "Check In / Out", icon: ClipboardCheck },
  { href: "/accounts", label: "Accounts", icon: Building2 },
  { href: "/fda-lots", label: "FDA Lot Tracking", icon: ShieldCheck },
];

export default function Sidebar() {
  const pathname = usePathname();

  if (pathname === "/login") {
    return null;
  }

  return (
    <aside className="flex flex-col w-64 min-h-screen bg-gray-950 border-r border-gray-800">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-sky-600">
          <FlaskConical className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-tight">Dental Lab</p>
          <p className="text-xs text-gray-500">CRM System</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                active
                  ? "bg-sky-600 text-white shadow-lg shadow-sky-900/40"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0",
                  active ? "text-white" : "text-gray-500 group-hover:text-gray-300"
                )}
              />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight className="w-3 h-3 text-sky-300" />}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t border-gray-800">
        <p className="text-xs text-gray-600 text-center">Dental Lab CRM v1.0</p>
      </div>
    </aside>
  );
}
