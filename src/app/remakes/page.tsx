import CasesPageView from "@/components/ui/CasesPageView";

export default function RemakesPage() {
  return (
    <CasesPageView
      title="Remakes"
      description="Cases being redone due to fit, esthetic, or other issues"
      statusFilter="REMAKE"
      allowStatusChange
    />
  );
}
