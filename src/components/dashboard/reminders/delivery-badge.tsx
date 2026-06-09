import { Badge } from "@/components/ui/primitives";
import type { Reminder } from "@/lib/mock-reminders";

export function DeliveryBadge({ status }: { status: NonNullable<Reminder["deliveryStatus"]> }) {
  const tone = status === "delivered" ? "clause" : status === "pending" ? "ember" : "coral";
  const label = status === "delivered"
    ? "Delivered"
    : status === "bounced"
    ? "Bounced"
    : status === "complained"
    ? "Complaint"
    : "Pending";

  return <Badge tone={tone}>{label}</Badge>;
}
