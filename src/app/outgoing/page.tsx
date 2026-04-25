import CasesPageView from "@/components/ui/CasesPageView";

export default function OutgoingPage({
  searchParams,
}: {
  searchParams?: { search?: string };
}) {
  return (
    <CasesPageView
      title="Outgoing Cases"
      description="Completed cases ready for delivery or shipment"
      statusFilter="COMPLETE,SHIPPED"
      allowStatusChange
      initialSearch={searchParams?.search ?? ""}
    />
  );
}
