import ShopifyOrders from "@/components/ShopifyOrders";
import CasesPageView from "@/components/ui/CasesPageView";

export default function IncomingPage() {
  return (
    <div>
      <ShopifyOrders />
      <CasesPageView
        title="Incoming Cases"
        description="New cases received from dental offices awaiting processing"
        statusFilter="INCOMING"
        allowStatusChange
      />
    </div>
  );
}
