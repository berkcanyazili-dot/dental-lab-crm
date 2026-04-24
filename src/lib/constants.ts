export const CASE_STATUSES = {
  INCOMING: "INCOMING",
  IN_LAB: "IN_LAB",
  WIP: "WIP",
  HOLD: "HOLD",
  REMAKE: "REMAKE",
  COMPLETE: "COMPLETE",
  SHIPPED: "SHIPPED",
} as const;

export const PRODUCT_TYPES = [
  "Crown",
  "Implant Crown",
  "Full Arch Restoration",
  "Anterior Zirconia",
  "Posterior Zirconia",
  "PFM High Noble Yellow",
  "PFM High Noble White",
  "Veneer Pressable",
  "Full Case Unlimited",
  "Denture",
  "Acrylic Partial",
  "Cast Partial",
  "Ortho Retainer",
  "Soft Tissue",
  "Custom Tray",
] as const;

export const PRIORITY_LEVELS = {
  NORMAL: "NORMAL",
  RUSH: "RUSH",
  STAT: "STAT",
} as const;

export const STATUS_COLORS: Record<string, string> = {
  INCOMING: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  IN_LAB: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  WIP: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  HOLD: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  REMAKE: "bg-red-500/20 text-red-400 border-red-500/30",
  COMPLETE: "bg-green-500/20 text-green-400 border-green-500/30",
  SHIPPED: "bg-teal-500/20 text-teal-400 border-teal-500/30",
};

export const PRIORITY_COLORS: Record<string, string> = {
  NORMAL: "bg-gray-500/20 text-gray-400",
  RUSH: "bg-amber-500/20 text-amber-400",
  STAT: "bg-red-500/20 text-red-400",
};
