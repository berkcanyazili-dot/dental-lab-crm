"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Printer } from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────── */
interface CaseItem {
  id: string;
  productType: string;
  units: number;
  shade: string | null;
  toothNumbers: string | null;
  notes: string | null;
}

interface ScheduleStep {
  id: string;
  department: string;
  sortOrder: number;
  status: string;
  technician: { name: string } | null;
  scheduledDate: string | null;
  completedDate: string | null;
}

interface CaseDetail {
  id: string;
  caseNumber: string;
  patientName: string;
  patientFirst: string | null;
  patientMI: string | null;
  patientLast: string | null;
  pan: string | null;
  shade: string | null;
  softTissueShade: string | null;
  metalSelection: string | null;
  selectedTeeth: string | null;
  receivedDate: string;
  dueDate: string | null;
  shippingCarrier: string | null;
  shippingAddress: string | null;
  route: string;
  caseType: string;
  notes: string | null;
  dentalAccount: {
    name: string;
    doctorName: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
  technician: { name: string } | null;
  items: CaseItem[];
  schedule: ScheduleStep[];
}

/* ─── Helpers ────────────────────────────────────────────────── */
const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function formatTicketDate(iso: string) {
  const d = new Date(iso);
  return {
    day: DAY_NAMES[d.getDay()],
    num: String(d.getDate()).padStart(2, "0"),
    full: d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
  };
}

function formatLong(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const ROUTE_LABELS: Record<string, string> = {
  LOCAL: "Local Delivery",
  UPS_GROUND: "UPS Ground",
  UPS_2DAY: "UPS 2nd Day Air",
  FEDEX: "FedEx",
};

/* ─── Work Ticket ────────────────────────────────────────────── */
export default function WorkTicketPage() {
  const { id } = useParams<{ id: string }>();
  const [caseData, setCaseData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/cases/${id}`)
      .then((r) => r.json())
      .then((d) => { setCaseData(d); setLoading(false); });
  }, [id]);

  if (loading || !caseData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400" />
      </div>
    );
  }

  const received = formatTicketDate(caseData.receivedDate);
  const selectedTeeth: number[] = caseData.selectedTeeth ? JSON.parse(caseData.selectedTeeth) : [];

  const fullPatientName =
    [caseData.patientFirst, caseData.patientMI ? `${caseData.patientMI}.` : null, caseData.patientLast]
      .filter(Boolean)
      .join(" ") || caseData.patientName;

  const practiceAddress = [
    caseData.dentalAccount.address,
    caseData.dentalAccount.city,
    caseData.dentalAccount.state,
    caseData.dentalAccount.zip,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      {/* Print-only styles injected into head */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
          .ticket-page { box-shadow: none !important; border: none !important; }
        }
        @page {
          size: letter;
          margin: 0.5in;
        }
        @media screen {
          body { background: #e5e7eb; }
        }
      `}</style>

      {/* Print button — hidden in print */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg shadow-lg transition-colors"
        >
          <Printer className="w-4 h-4" />
          Print Work Ticket
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium rounded-lg shadow-lg transition-colors"
        >
          Close
        </button>
      </div>

      {/* Ticket wrapper — centers on screen, full-width in print */}
      <div className="min-h-screen py-8 px-4 flex justify-center">
        <div
          className="ticket-page bg-white w-full max-w-[720px] shadow-xl border border-gray-200"
          style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "11px", color: "#111" }}
        >
          {/* ── Header: Date + Pan ── */}
          <div className="flex items-stretch border-b-2 border-black">
            <div className="flex-1 px-5 py-4 border-r-2 border-black">
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>
                Date Received
              </div>
              <div style={{ fontSize: "42px", fontWeight: 900, lineHeight: 1, letterSpacing: "-0.02em" }}>
                {received.day}{" "}
                <span style={{ color: "#1d4ed8" }}>{received.num}</span>
              </div>
              <div style={{ fontSize: "13px", color: "#555", marginTop: "2px" }}>{received.full}</div>
            </div>

            <div className="flex-1 px-5 py-4 border-r-2 border-black flex flex-col justify-center">
              {caseData.pan ? (
                <>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>
                    Pan Number
                  </div>
                  <div style={{ fontSize: "52px", fontWeight: 900, lineHeight: 1, color: "#1d4ed8" }}>
                    {caseData.pan}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>
                    Case Number
                  </div>
                  <div style={{ fontSize: "28px", fontWeight: 900, lineHeight: 1 }}>
                    {caseData.caseNumber}
                  </div>
                </>
              )}
            </div>

            <div className="flex-1 px-5 py-4 flex flex-col justify-center">
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                Dental Lab Work Ticket
              </div>
              <div style={{ fontSize: "13px", fontWeight: 700 }}>{caseData.caseNumber}</div>
              <div style={{ marginTop: "4px" }}>
                <span style={{ display: "inline-block", padding: "2px 8px", background: "#1d4ed8", color: "white", fontSize: "10px", fontWeight: 700, borderRadius: "3px", textTransform: "uppercase" }}>
                  {caseData.caseType}
                </span>
              </div>
            </div>
          </div>

          {/* ── Doctor / Practice row ── */}
          <div className="flex border-b border-gray-300">
            <div className="flex-1 px-5 py-3 border-r border-gray-300">
              <TicketLabel>Doctor</TicketLabel>
              <div style={{ fontSize: "13px", fontWeight: 700 }}>
                {caseData.dentalAccount.doctorName ? `Dr. ${caseData.dentalAccount.doctorName}` : "—"}
              </div>
              <div style={{ color: "#555", marginTop: "1px" }}>{caseData.dentalAccount.name}</div>
            </div>
            <div className="flex-1 px-5 py-3 border-r border-gray-300">
              <TicketLabel>Practice Address</TicketLabel>
              <div style={{ color: "#333" }}>{practiceAddress || "—"}</div>
            </div>
            <div className="flex-1 px-5 py-3">
              <TicketLabel>Phone</TicketLabel>
              <div style={{ fontSize: "13px", fontWeight: 600 }}>{caseData.dentalAccount.phone ?? "—"}</div>
            </div>
          </div>

          {/* ── Case info row ── */}
          <div className="flex border-b border-gray-300">
            <div className="flex-1 px-5 py-3 border-r border-gray-300">
              <TicketLabel>Date Received</TicketLabel>
              <div style={{ fontWeight: 600 }}>{formatLong(caseData.receivedDate)}</div>
            </div>
            <div className="flex-1 px-5 py-3 border-r border-gray-300">
              <TicketLabel>Due Date</TicketLabel>
              <div style={{ fontWeight: 600 }}>{formatLong(caseData.dueDate)}</div>
            </div>
            <div className="flex-1 px-5 py-3 border-r border-gray-300">
              <TicketLabel>Delivery Method</TicketLabel>
              <div style={{ fontWeight: 600 }}>{ROUTE_LABELS[caseData.route] ?? caseData.route}</div>
            </div>
            <div className="flex-1 px-5 py-3">
              <TicketLabel>Carrier</TicketLabel>
              <div style={{ fontWeight: 600 }}>{caseData.shippingCarrier ?? "—"}</div>
            </div>
          </div>

          {/* ── Patient row ── */}
          <div className="flex border-b-2 border-black">
            <div className="flex-1 px-5 py-3 border-r border-gray-300">
              <TicketLabel>Patient Name</TicketLabel>
              <div style={{ fontSize: "14px", fontWeight: 700 }}>{fullPatientName}</div>
            </div>
            <div className="px-5 py-3 border-r border-gray-300" style={{ minWidth: "90px" }}>
              <TicketLabel>Pan #</TicketLabel>
              <div style={{ fontSize: "18px", fontWeight: 900, color: "#1d4ed8" }}>{caseData.pan ?? "—"}</div>
            </div>
            <div className="flex-1 px-5 py-3">
              <TicketLabel>Operator / Technician</TicketLabel>
              <div style={{ fontWeight: 600 }}>{caseData.technician?.name ?? "—"}</div>
            </div>
          </div>

          {/* ── Restored Teeth & Shade ── */}
          <SectionHeader>Restored Teeth &amp; Shade</SectionHeader>
          <div className="flex border-b border-gray-300">
            <div className="flex-1 px-5 py-3 border-r border-gray-300">
              <TicketLabel>Tooth Numbers</TicketLabel>
              <div style={{ fontSize: "13px", fontWeight: 600, letterSpacing: "0.03em" }}>
                {selectedTeeth.length > 0
                  ? selectedTeeth.sort((a, b) => a - b).join(", ")
                  : "None indicated"}
              </div>
            </div>
            <div className="px-5 py-3 border-r border-gray-300" style={{ minWidth: "110px" }}>
              <TicketLabel>Shade</TicketLabel>
              <div style={{ fontSize: "16px", fontWeight: 900 }}>{caseData.shade ?? "—"}</div>
            </div>
            <div className="px-5 py-3 border-r border-gray-300" style={{ minWidth: "130px" }}>
              <TicketLabel>Soft Tissue Shade</TicketLabel>
              <div style={{ fontSize: "14px", fontWeight: 700 }}>{caseData.softTissueShade ?? "—"}</div>
            </div>
            <div className="px-5 py-3" style={{ minWidth: "130px" }}>
              <TicketLabel>Alloy Weight</TicketLabel>
              <div style={{ borderBottom: "1px solid #999", marginTop: "10px", width: "100px" }}>&nbsp;</div>
            </div>
          </div>

          {/* ── Metal selection ── */}
          {caseData.metalSelection && caseData.metalSelection !== "None" && (
            <div className="px-5 py-2 border-b border-gray-300" style={{ background: "#f9fafb" }}>
              <span style={{ fontWeight: 600 }}>Metal / Alloy: </span>
              <span>{caseData.metalSelection}</span>
            </div>
          )}

          {/* ── Products ── */}
          <SectionHeader>Products / Services</SectionHeader>
          <div className="border-b-2 border-black">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f3f4f6", borderBottom: "1px solid #d1d5db" }}>
                  <th style={thStyle}>Qty</th>
                  <th style={{ ...thStyle, textAlign: "left", paddingLeft: "12px", width: "60%" }}>Description</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Tooth #s</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Shade</th>
                </tr>
              </thead>
              <tbody>
                {caseData.items.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: "10px 12px", color: "#9ca3af", fontStyle: "italic" }}>
                      No products listed
                    </td>
                  </tr>
                ) : (
                  caseData.items.map((item, idx) => (
                    <tr key={item.id} style={{ background: idx % 2 === 0 ? "white" : "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ ...tdStyle, textAlign: "center", fontWeight: 700, fontSize: "13px" }}>{item.units}</td>
                      <td style={{ ...tdStyle, paddingLeft: "12px", fontWeight: 600 }}>{item.productType}</td>
                      <td style={tdStyle}>{item.toothNumbers ?? "—"}</td>
                      <td style={tdStyle}>{item.shade ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Production Schedule ── */}
          <SectionHeader>Production Schedule</SectionHeader>
          <div className="border-b-2 border-black">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f3f4f6", borderBottom: "1px solid #d1d5db" }}>
                  <th style={{ ...thStyle, textAlign: "left", paddingLeft: "12px", width: "30%" }}>Department / Step</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Technician</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Scheduled Date</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Completed Date</th>
                  <th style={{ ...thStyle, textAlign: "left" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {caseData.schedule.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: "10px 12px", color: "#9ca3af", fontStyle: "italic" }}>
                      No schedule generated
                    </td>
                  </tr>
                ) : (
                  caseData.schedule.map((step, idx) => (
                    <tr
                      key={step.id}
                      style={{
                        background: step.status === "COMPLETE"
                          ? "#f0fdf4"
                          : step.status === "IN_PROCESS"
                          ? "#fffbeb"
                          : idx % 2 === 0 ? "white" : "#f9fafb",
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      <td style={{ ...tdStyle, paddingLeft: "12px", fontWeight: 700 }}>{step.department}</td>
                      <td style={tdStyle}>{step.technician?.name ?? "—"}</td>
                      <td style={tdStyle}>{formatLong(step.scheduledDate)}</td>
                      <td style={{ ...tdStyle, color: step.completedDate ? "#16a34a" : "#9ca3af" }}>
                        {formatLong(step.completedDate)}
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "1px 6px",
                            borderRadius: "3px",
                            fontSize: "9px",
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            background:
                              step.status === "COMPLETE" ? "#dcfce7" :
                              step.status === "IN_PROCESS" ? "#fef9c3" :
                              step.status === "READY" ? "#dbeafe" : "#f3f4f6",
                            color:
                              step.status === "COMPLETE" ? "#15803d" :
                              step.status === "IN_PROCESS" ? "#92400e" :
                              step.status === "READY" ? "#1d4ed8" : "#6b7280",
                          }}
                        >
                          {step.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Notes ── */}
          {caseData.notes && (
            <>
              <SectionHeader>Notes</SectionHeader>
              <div className="px-5 py-3 border-b-2 border-black">
                <p style={{ whiteSpace: "pre-wrap", color: "#374151" }}>{caseData.notes}</p>
              </div>
            </>
          )}

          {/* ── Signature lines ── */}
          <div className="flex" style={{ marginTop: "8px" }}>
            {["Checked By", "Crown & Bridge", "Ceramist"].map((label, i) => (
              <div
                key={label}
                className="flex-1 px-5 py-4"
                style={{ borderRight: i < 2 ? "1px solid #d1d5db" : "none" }}
              >
                <div style={{ borderBottom: "1px solid #374151", marginBottom: "6px", paddingBottom: "18px" }} />
                <div style={{ fontSize: "10px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* ── Footer ── */}
          <div
            style={{
              borderTop: "2px solid black",
              padding: "6px 20px",
              background: "#f9fafb",
              display: "flex",
              justifyContent: "space-between",
              fontSize: "9px",
              color: "#6b7280",
            }}
          >
            <span>Dental Lab CRM — Work Ticket</span>
            <span>{caseData.caseNumber}</span>
            <span>Printed: {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Small print-layout sub-components ──────────────────────── */
function TicketLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "9px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        color: "#6b7280",
        marginBottom: "3px",
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "4px 20px",
        background: "#1e3a5f",
        color: "white",
        fontSize: "10px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
      }}
    >
      {children}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "5px 8px",
  fontSize: "9px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#374151",
  textAlign: "center",
};

const tdStyle: React.CSSProperties = {
  padding: "6px 8px",
  fontSize: "11px",
  color: "#374151",
  verticalAlign: "top",
};
