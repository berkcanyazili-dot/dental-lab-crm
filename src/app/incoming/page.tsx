import ShopifyOrders from "@/components/ShopifyOrders";
import CasesPageView from "@/components/ui/CasesPageView";

export default function IncomingPage({
  searchParams,
}: {
  searchParams?: { search?: string };
}) {
  return (
    <div>
      <ShopifyOrders />
      <CasesPageView
        title="Incoming Cases"
        description="New cases received from dental offices awaiting processing"
        statusFilter="INCOMING"
        allowStatusChange
        initialSearch={searchParams?.search ?? ""}
      />
    </div>
  );
}
