import CasesPageView from "@/components/ui/CasesPageView";

export default function HistoryPage({
  searchParams,
}: {
  searchParams?: { search?: string };
}) {
  return (
    <CasesPageView
      title="Case History"
      description="All completed and shipped cases"
      statusFilter="COMPLETE,SHIPPED"
      initialSearch={searchParams?.search ?? ""}
    />
  );
}
