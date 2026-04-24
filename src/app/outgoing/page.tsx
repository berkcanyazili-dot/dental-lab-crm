import CasesPageView from "@/components/ui/CasesPageView";

export default function OutgoingPage() {
  return (
    <CasesPageView
      title="Outgoing Cases"
      description="Completed cases ready for delivery or shipment"
      statusFilter="COMPLETE,SHIPPED"
      allowStatusChange
    />
  );
}
