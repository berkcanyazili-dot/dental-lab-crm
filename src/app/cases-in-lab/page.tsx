import CasesPageView from "@/components/ui/CasesPageView";

export default function CasesInLabPage() {
  return (
    <CasesPageView
      title="Cases In Lab"
      description="All cases currently inside the laboratory"
      statusFilter="INCOMING,IN_LAB,WIP,HOLD"
      allowStatusChange
    />
  );
}
