import CasesPageView from "@/components/ui/CasesPageView";

export default function HistoryPage() {
  return (
    <CasesPageView
      title="Case History"
      description="All completed and shipped cases"
      statusFilter="COMPLETE,SHIPPED"
    />
  );
}
