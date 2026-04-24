import CasesPageView from "@/components/ui/CasesPageView";

export default function WipPage() {
  return (
    <CasesPageView
      title="Work In Progress"
      description="Cases actively being worked on by technicians"
      statusFilter="WIP,IN_LAB"
      allowStatusChange
    />
  );
}
