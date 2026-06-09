import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeliveryBadge } from "./delivery-badge";

describe("DeliveryBadge", () => {
  it.each([
    ["delivered", "Delivered"],
    ["bounced", "Bounced"],
    ["complained", "Complaint"],
    ["pending", "Pending"],
  ] as const)("renders %s delivery status", (status, label) => {
    render(<DeliveryBadge status={status} />);

    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
