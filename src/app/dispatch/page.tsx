"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  MapPin,
  PackageCheck,
  RefreshCw,
  Search,
  Truck,
} from "lucide-react";
import { STATUS_COLORS, PRIORITY_COLORS } from "@/lib/constants";
import { cn, formatDate } from "@/lib/utils";

interface DispatchCase {
  id: string;
  caseNumber: string;
  patientName: string;
  status: string;
  priority: string;
  route: "LOCAL" | "SHIP" | "PICKUP";
  logisticsStatus: string;
  dueDate: string | null;
  shippedDate: string | null;
  pickupDate: string | null;
  deliveryDate: string | null;
  shippingAddress: string | null;
  shippingCarrier: string | null;
  shippingTime: string | null;
  courierName: string | null;
  trackingNumber: string | null;
  dispatchNotes: string | null;
  dentalAccount: {
    name: string;
    doctorName: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
  items: Array<{ id: string; productType: string; toothNumbers: string | null; units: number }>;
}

const LOGISTICS_COLUMNS = [
  { key: "NOT_SCHEDULED", label: "Ready / Unscheduled" },
  { key: "PICKUP_REQUESTED", label: "Pickup Requested" },
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { key: "IN_TRANSIT", label: "In Transit" },
  { key: "DELIVERED", label: "Delivered" },
];

const ROUTES = ["LOCAL", "PICKUP", "SHIP"] as const;
const CARRIERS = ["", "Local Courier", "UPS", "FedEx", "USPS", "Doctor Pickup"];

function toDateInput(value: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function accountAddress(caseItem: DispatchCase) {
  return [
    caseItem.shippingAddress,
    caseItem.dentalAccount.address,
    caseItem.dentalAccount.city,
    caseItem.dentalAccount.state,
    caseItem.dentalAccount.zip,
  ]
    .filter(Boolean)
    .join(", ");
}

function isDueToday(value: string | null) {
  if (!value) return false;
  const date = new Date(value);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function buildDriverStops(cases: DispatchCase[]) {
  return cases
    .map((caseItem) => ({
      caseId: caseItem.id,
      caseNumber: caseItem.caseNumber,
      patientName: caseItem.patientName,
      accountName: caseItem.dentalAccount.name,
      address: accountAddress(caseItem),
      deliveryDate: caseItem.deliveryDate,
      dueDate: caseItem.dueDate,
      shippingTime: caseItem.shippingTime,
      logisticsStatus: caseItem.logisticsStatus,
    }))
    .filter((stop) => stop.address)
    .sort((a, b) => {
      const aDate = a.deliveryDate ?? a.dueDate ?? "";
      const bDate = b.deliveryDate ?? b.dueDate ?? "";
      return aDate.localeCompare(bDate) || a.accountName.localeCompare(b.accountName);
    });
}

function googleMapsDirectionsUrl(addresses: string[]) {
  if (addresses.length === 0) return null;
  if (addresses.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addresses[0])}`;
  }

  const origin = addresses[0];
  const destination = addresses[addresses.length - 1];
  const waypoints = addresses.slice(1, -1);
  const params = new URLSearchParams({
    api: "1",
    travelmode: "driving",
    origin,
    destination,
  });
  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.join("|"));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function googleMapsEmbedUrl(addresses: string[]) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey || addresses.length === 0) return null;

  if (addresses.length === 1) {
    const params = new URLSearchParams({
      key: apiKey,
      q: addresses[0],
    });
    return `https://www.google.com/maps/embed/v1/place?${params.toString()}`;
  }

  const origin = addresses[0];
  const destination = addresses[addresses.length - 1];
  const waypoints = addresses.slice(1, -1);
  const params = new URLSearchParams({
    key: apiKey,
    origin,
    destination,
    mode: "driving",
  });
  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.join("|"));
  }
  return `https://www.google.com/maps/embed/v1/directions?${params.toString()}`;
}

export default function DispatchPage() {
  const [cases, setCases] = useState<DispatchCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [routeFilter, setRouteFilter] = useState<"ALL" | "LOCAL" | "PICKUP" | "SHIP">("ALL");

  async function load() {
    setLoading(true);
    const params = routeFilter === "ALL" ? "" : `?route=${routeFilter}`;
    const response = await fetch(`/api/dispatch${params}`);
    const data = await response.json();
    setCases(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeFilter]);

  const filteredCases = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return cases;
    return cases.filter(
      (caseItem) =>
        caseItem.caseNumber.toLowerCase().includes(query) ||
        caseItem.patientName.toLowerCase().includes(query) ||
        caseItem.dentalAccount.name.toLowerCase().includes(query) ||
        (caseItem.trackingNumber ?? "").toLowerCase().includes(query)
    );
  }, [cases, search]);

  const grouped = useMemo(() => {
    return LOGISTICS_COLUMNS.reduce<Record<string, DispatchCase[]>>((acc, column) => {
      acc[column.key] = filteredCases.filter((caseItem) => caseItem.logisticsStatus === column.key);
      return acc;
    }, {});
  }, [filteredCases]);

  const localDueTodayStops = useMemo(() => {
    return buildDriverStops(
      filteredCases.filter(
        (caseItem) =>
          caseItem.route === "LOCAL" &&
          isDueToday(caseItem.dueDate) &&
          caseItem.logisticsStatus !== "DELIVERED"
      )
    );
  }, [filteredCases]);

  const localTodayMapUrl = useMemo(
    () => googleMapsEmbedUrl(localDueTodayStops.map((stop) => stop.address)),
    [localDueTodayStops]
  );

  const localTodayDirectionsUrl = useMemo(
    () => googleMapsDirectionsUrl(localDueTodayStops.map((stop) => stop.address)),
    [localDueTodayStops]
  );

  async function updateDispatch(caseId: string, patch: Partial<DispatchCase> & { logisticsStatus?: string }) {
    setSavingId(caseId);
    try {
      const response = await fetch("/api/dispatch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, ...patch, _authorName: "Dispatch" }),
      });
      if (response.ok) {
        const updated = await response.json();
        setCases((current) => current.map((caseItem) => (caseItem.id === caseId ? updated : caseItem)));
      }
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dispatch Board</h1>
          <p className="mt-1 text-sm text-gray-400">Schedule pickups, deliveries, shipments, tracking, and handoff status.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search case, account, tracking"
              className="h-9 w-72 rounded-lg border border-gray-700 bg-gray-950 pl-9 pr-3 text-sm text-white outline-none focus:border-sky-500"
            />
          </div>
          <select
            value={routeFilter}
            onChange={(event) => setRouteFilter(event.target.value as typeof routeFilter)}
            className="h-9 rounded-lg border border-gray-700 bg-gray-950 px-3 text-sm text-white outline-none focus:border-sky-500"
          >
            <option value="ALL">All routes</option>
            {ROUTES.map((route) => <option key={route}>{route}</option>)}
          </select>
          <button
            type="button"
            onClick={load}
            className="flex h-9 items-center gap-2 rounded-lg border border-gray-700 px-3 text-sm text-gray-300 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      <section className="mb-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Dispatch Cases</p>
          <p className="mt-2 text-3xl font-bold text-white">{filteredCases.length}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Scheduled</p>
          <p className="mt-2 text-3xl font-bold text-sky-300">{grouped.SCHEDULED?.length ?? 0}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">In Motion</p>
          <p className="mt-2 text-3xl font-bold text-amber-300">{(grouped.OUT_FOR_DELIVERY?.length ?? 0) + (grouped.IN_TRANSIT?.length ?? 0)}</p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-950 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Delivered</p>
          <p className="mt-2 text-3xl font-bold text-emerald-300">{grouped.DELIVERED?.length ?? 0}</p>
        </div>
      </section>

      <section className="mb-5 rounded-xl border border-gray-800 bg-gray-950">
        <div className="flex flex-col gap-3 border-b border-gray-800 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Driver Routing View</h2>
            <p className="mt-1 text-sm text-gray-400">
              Today&apos;s local deliveries plotted for the driver. Uses Google Maps when a browser API key is configured.
            </p>
          </div>
          {localTodayDirectionsUrl ? (
            <a
              href={localTodayDirectionsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-sky-600 px-4 text-sm font-semibold text-white hover:bg-sky-500"
            >
              <Truck className="h-4 w-4" />
              Open Route in Google Maps
              <ExternalLink className="h-4 w-4" />
            </a>
          ) : null}
        </div>

        <div className="grid gap-4 p-4 xl:grid-cols-[1.5fr_1fr]">
          <div className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900">
            {localTodayMapUrl ? (
              <iframe
                title="Today's delivery route"
                src={localTodayMapUrl}
                className="h-[420px] w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="flex h-[420px] flex-col items-center justify-center gap-3 px-6 text-center text-sm text-gray-400">
                <MapPin className="h-8 w-8 text-sky-400" />
                {localDueTodayStops.length === 0 ? (
                  <p>No LOCAL cases due today are ready for routing.</p>
                ) : (
                  <>
                    <p>Map preview needs `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` to render inside the CRM.</p>
                    {localTodayDirectionsUrl ? (
                      <a
                        href={localTodayDirectionsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-white hover:border-sky-500"
                      >
                        Open the route externally
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-900">
            <div className="border-b border-gray-800 px-4 py-3">
              <h3 className="text-sm font-semibold text-white">Today&apos;s Local Stops</h3>
              <p className="mt-1 text-xs text-gray-500">{localDueTodayStops.length} stop(s)</p>
            </div>
            <div className="max-h-[420px] space-y-3 overflow-y-auto p-3">
              {localDueTodayStops.length === 0 ? (
                <div className="flex min-h-40 flex-col items-center justify-center rounded-lg border border-dashed border-gray-800 text-center text-sm text-gray-500">
                  <Truck className="mb-2 h-5 w-5" />
                  No local deliveries due today
                </div>
              ) : (
                localDueTodayStops.map((stop, index) => (
                  <Link
                    key={`${stop.caseId}-${stop.address}`}
                    href={`/cases/${stop.caseId}`}
                    className="block rounded-lg border border-gray-800 bg-gray-950 p-3 transition-colors hover:border-sky-700 hover:bg-gray-900"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-600/20 text-xs font-bold text-sky-300">
                          {index + 1}
                        </span>
                        <span className="font-semibold text-white">{stop.caseNumber}</span>
                      </div>
                      <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[11px] text-gray-300">
                        {stop.logisticsStatus.replaceAll("_", " ")}
                      </span>
                    </div>
                    <p className="text-sm text-gray-200">{stop.accountName}</p>
                    <p className="text-xs text-gray-500">{stop.patientName}</p>
                    <p className="mt-2 line-clamp-3 text-xs text-gray-400">{stop.address}</p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                      <span>Due {formatDate(stop.dueDate)}</span>
                      <span>{stop.shippingTime || "Any time"}</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-xl border border-gray-800 bg-gray-950 p-8 text-center text-sm text-gray-400">Loading dispatch...</div>
      ) : (
        <div className="grid gap-4 2xl:grid-cols-3">
          {LOGISTICS_COLUMNS.map((column) => (
            <section key={column.key} className="min-h-80 rounded-xl border border-gray-800 bg-gray-950">
              <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
                <h2 className="text-sm font-semibold text-white">{column.label}</h2>
                <span className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-400">{grouped[column.key]?.length ?? 0}</span>
              </div>
              <div className="space-y-3 p-3">
                {(grouped[column.key] ?? []).map((caseItem) => (
                  <article key={caseItem.id} className="rounded-lg border border-gray-800 bg-gray-900 p-3">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link href={`/cases/${caseItem.id}`} className="font-bold text-white hover:text-sky-300">
                          {caseItem.caseNumber}
                        </Link>
                        <p className="truncate text-sm text-gray-300">{caseItem.patientName}</p>
                        <p className="truncate text-xs text-gray-500">
                          {caseItem.dentalAccount.name}
                          {caseItem.dentalAccount.doctorName ? ` / Dr. ${caseItem.dentalAccount.doctorName}` : ""}
                        </p>
                      </div>
                      {savingId === caseItem.id ? <Loader2 className="h-4 w-4 animate-spin text-sky-300" /> : null}
                    </div>

                    <div className="mb-3 flex flex-wrap gap-1.5">
                      <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", STATUS_COLORS[caseItem.status])}>
                        {caseItem.status.replace("_", " ")}
                      </span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", PRIORITY_COLORS[caseItem.priority])}>
                        {caseItem.priority}
                      </span>
                      <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[11px] font-semibold text-gray-300">
                        {caseItem.route}
                      </span>
                    </div>

                    <div className="mb-3 space-y-1.5 text-xs text-gray-400">
                      <p className="flex gap-2"><MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" /> <span className="line-clamp-2">{accountAddress(caseItem) || "No address"}</span></p>
                      <p className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5" /> Due {formatDate(caseItem.dueDate)}</p>
                      <p className="flex items-center gap-2"><Truck className="h-3.5 w-3.5" /> {caseItem.shippingCarrier || "Carrier not set"} {caseItem.shippingTime ? `at ${caseItem.shippingTime}` : ""}</p>
                    </div>

                    <div className="grid gap-2">
                      <select
                        value={caseItem.logisticsStatus}
                        onChange={(event) => updateDispatch(caseItem.id, { logisticsStatus: event.target.value })}
                        className="h-8 rounded border border-gray-700 bg-gray-950 px-2 text-xs text-white outline-none focus:border-sky-500"
                      >
                        {LOGISTICS_COLUMNS.map((status) => <option key={status.key} value={status.key}>{status.label}</option>)}
                      </select>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={caseItem.route}
                          onChange={(event) => updateDispatch(caseItem.id, { route: event.target.value as DispatchCase["route"] })}
                          className="h-8 rounded border border-gray-700 bg-gray-950 px-2 text-xs text-white outline-none focus:border-sky-500"
                        >
                          {ROUTES.map((route) => <option key={route}>{route}</option>)}
                        </select>
                        <select
                          value={caseItem.shippingCarrier ?? ""}
                          onChange={(event) => updateDispatch(caseItem.id, { shippingCarrier: event.target.value || null })}
                          className="h-8 rounded border border-gray-700 bg-gray-950 px-2 text-xs text-white outline-none focus:border-sky-500"
                        >
                          {CARRIERS.map((carrier) => <option key={carrier} value={carrier}>{carrier || "Carrier"}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={toDateInput(caseItem.pickupDate)}
                          onChange={(event) => updateDispatch(caseItem.id, { pickupDate: event.target.value ? new Date(event.target.value).toISOString() : null })}
                          className="h-8 rounded border border-gray-700 bg-gray-950 px-2 text-xs text-white outline-none focus:border-sky-500"
                        />
                        <input
                          type="date"
                          value={toDateInput(caseItem.deliveryDate)}
                          onChange={(event) => updateDispatch(caseItem.id, { deliveryDate: event.target.value ? new Date(event.target.value).toISOString() : null })}
                          className="h-8 rounded border border-gray-700 bg-gray-950 px-2 text-xs text-white outline-none focus:border-sky-500"
                        />
                      </div>
                      <input
                        value={caseItem.courierName ?? ""}
                        onChange={(event) => updateDispatch(caseItem.id, { courierName: event.target.value || null })}
                        placeholder="Courier / driver"
                        className="h-8 rounded border border-gray-700 bg-gray-950 px-2 text-xs text-white outline-none placeholder:text-gray-600 focus:border-sky-500"
                      />
                      <input
                        value={caseItem.trackingNumber ?? ""}
                        onChange={(event) => updateDispatch(caseItem.id, { trackingNumber: event.target.value || null })}
                        placeholder="Tracking number"
                        className="h-8 rounded border border-gray-700 bg-gray-950 px-2 text-xs text-white outline-none placeholder:text-gray-600 focus:border-sky-500"
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => updateDispatch(caseItem.id, { logisticsStatus: caseItem.route === "SHIP" ? "IN_TRANSIT" : "OUT_FOR_DELIVERY" })}
                        className="flex h-8 items-center justify-center gap-1 rounded bg-amber-600 px-2 text-xs font-semibold text-white hover:bg-amber-500"
                      >
                        <Clock3 className="h-3.5 w-3.5" />
                        Start
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDispatch(caseItem.id, { logisticsStatus: "DELIVERED", deliveryDate: new Date().toISOString() })}
                        className="flex h-8 items-center justify-center gap-1 rounded bg-emerald-600 px-2 text-xs font-semibold text-white hover:bg-emerald-500"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Delivered
                      </button>
                    </div>
                  </article>
                ))}

                {(grouped[column.key] ?? []).length === 0 && (
                  <div className="flex min-h-28 flex-col items-center justify-center rounded-lg border border-dashed border-gray-800 text-center text-sm text-gray-500">
                    <PackageCheck className="mb-2 h-5 w-5" />
                    No cases
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
