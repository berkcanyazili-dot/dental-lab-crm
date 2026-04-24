import CasesPageView from "@/components/ui/CasesPageView";

export default function HoldPage() {
  return (
    <CasesPageView
      title="Hold Cases"
      description="Cases placed on hold pending doctor approval or materials"
      statusFilter="HOLD"
      allowStatusChange
    />
  );
}
