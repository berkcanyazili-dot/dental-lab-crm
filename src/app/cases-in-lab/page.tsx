import CasesPageView from "@/components/ui/CasesPageView";

export default function CasesInLabPage({
  searchParams,
}: {
  searchParams?: { search?: string };
}) {
  return (
    <CasesPageView
      title="Cases In Lab"
      description="All cases currently inside the laboratory"
      statusFilter="INCOMING,IN_LAB,WIP,HOLD"
      allowStatusChange
      initialSearch={searchParams?.search ?? ""}
    />
  );
}
