import CasesPageView from "@/components/ui/CasesPageView";

export default function RemakesPage({
  searchParams,
}: {
  searchParams?: { search?: string };
}) {
  return (
    <CasesPageView
      title="Remakes"
      description="Cases being redone due to fit, esthetic, or other issues"
      statusFilter="REMAKE"
      allowStatusChange
      initialSearch={searchParams?.search ?? ""}
    />
  );
}
