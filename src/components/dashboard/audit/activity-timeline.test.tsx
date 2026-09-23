import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ActivityTimeline, type AuditTimelineEvent } from "./activity-timeline";

const events: AuditTimelineEvent[] = [
  {
    id: "event-document",
    action: "document.uploaded",
    resourceType: "document",
    resourceId: "11111111-1111-4111-8111-111111111111",
    metadata: {},
    createdAt: new Date().toISOString(),
  },
  {
    id: "event-billing",
    action: "subscription.upgraded",
    resourceType: "subscription",
    resourceId: "11111111-1111-4111-8111-111111111111",
    metadata: { plan: "pro" },
    createdAt: new Date().toISOString(),
  },
];

describe("ActivityTimeline", () => {
  afterEach(() => cleanup());

  it("renders action labels and resource links", () => {
    render(<ActivityTimeline initialEvents={events} initialNextCursor={null} />);

    expect(screen.getByText("Uploaded a document")).toBeInTheDocument();
    expect(screen.getByText("Upgraded to Pro")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "View resource" })[0]).toHaveAttribute(
      "href",
      "/dashboard/documents/11111111-1111-4111-8111-111111111111"
    );
  });

  it("filters to billing events", () => {
    render(<ActivityTimeline initialEvents={events} initialNextCursor={null} />);

    fireEvent.click(screen.getByRole("button", { name: "Billing" }));

    expect(screen.queryByText("Uploaded a document")).not.toBeInTheDocument();
    expect(screen.getByText("Upgraded to Pro")).toBeInTheDocument();
  });

  it("renders an empty state when no events exist", () => {
    render(<ActivityTimeline initialEvents={[]} initialNextCursor={null} />);

    expect(screen.getByText("No activity yet.")).toBeInTheDocument();
  });

  it("does not link a deleted document to its now-gone detail page", () => {
    const deletedEvent: AuditTimelineEvent = {
      id: "event-document-deleted",
      action: "document.deleted",
      resourceType: "document",
      resourceId: "22222222-2222-4222-8222-222222222222",
      metadata: {},
      createdAt: new Date().toISOString(),
    };

    render(<ActivityTimeline initialEvents={[deletedEvent]} initialNextCursor={null} />);

    expect(screen.getByText("Deleted a document")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View resource" })).not.toBeInTheDocument();
    expect(screen.getByText(/^ID 22222222/)).toBeInTheDocument();
  });
});
