import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useReminders, type ReminderMutationPatch } from "../use-reminders";
import type { Reminder } from "@/lib/mock-reminders";

const reminder: Reminder = {
  id: "reminder-1",
  docId: "document-1",
  docTitle: "Lease agreement",
  title: "Review renewal",
  description: "Check renewal language.",
  fireOn: "Jul 1, 2026",
  daysAway: 23,
  status: "suggested",
  channel: "Email",
  type: "Renewal",
  reminderTime: null,
};

describe("useReminders", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches reminders and exposes loading state", async () => {
    const fetchMock = mockFetch(jsonResponse({ reminders: [reminder] }));

    const { result } = renderHook(() => useReminders({ status: "suggested", documentId: "11111111-1111-1111-1111-111111111111" }));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.reminders).toEqual([reminder]);
    expect(result.current.error).toBeNull();
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "http://localhost:3000/api/reminders?status=suggested&document_id=11111111-1111-1111-1111-111111111111"
    );
  });

  it("round-trips raw reminder_time and delivery status fields through the hook", async () => {
    mockFetch(jsonResponse({
      reminders: [{
        ...reminder,
        status: "sent",
        reminder_time: "09:30:00",
        delivery_status: "delivered",
      }],
    }));

    const { result } = renderHook(() => useReminders({ status: "sent" }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.reminders[0]).toMatchObject({
      reminderTime: "09:30",
      deliveryStatus: "delivered",
    });
  });

  it("sets an error when fetching reminders fails", async () => {
    mockFetch(jsonResponse({ error: "Unauthorized" }, { status: 401 }));

    const { result } = renderHook(() => useReminders());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.reminders).toEqual([]);
    expect(result.current.error).toBe("Unauthorized");
  });

  it("treats mock-mode 503 as empty without a hard error", async () => {
    mockFetch(jsonResponse({ error: "Supabase is not configured." }, { status: 503 }));

    const { result } = renderHook(() => useReminders());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.reminders).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("defaults sent reminders to pending delivery when no webhook status is present", async () => {
    mockFetch(jsonResponse({ reminders: [{ ...reminder, status: "sent" }] }));

    const { result } = renderHook(() => useReminders({ status: "sent" }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.reminders[0].deliveryStatus).toBe("pending");
  });

  it("calls approve, update, and dismiss endpoints with the expected bodies", async () => {
    const approved = { ...reminder, status: "approved" as const };
    const updated = { ...approved, title: "Updated title" };
    const approvePatch: ReminderMutationPatch = { fire_on: "2026-07-01", reminder_time: "09:30" };
    const updatePatch: ReminderMutationPatch = { title: "Updated title", description: "Updated description." };
    const fetchMock = mockFetch(
      jsonResponse({ reminders: [reminder] }),
      jsonResponse({ reminder: approved }),
      jsonResponse({ reminder: updated }),
      jsonResponse({ ok: true })
    );

    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.approve(reminder.id, approvePatch);
    });
    await act(async () => {
      await result.current.update(reminder.id, updatePatch);
    });
    await act(async () => {
      await result.current.dismiss(reminder.id);
    });

    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/reminders/reminder-1/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(approvePatch),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/reminders/reminder-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatePatch),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, "/api/reminders/reminder-1", { method: "DELETE" });
  });

  it("rolls back optimistic approval when the mutation fails", async () => {
    const approval = deferred<Response>();
    mockFetch(
      jsonResponse({ reminders: [reminder] }),
      approval.promise
    );

    const { result } = renderHook(() => useReminders());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let approvePromise: Promise<Reminder | null>;
    act(() => {
      approvePromise = result.current.approve(reminder.id);
    });

    await waitFor(() => expect(result.current.reminders[0].status).toBe("approved"));

    approval.resolve(jsonResponse({ error: "Approval failed" }, { status: 500 }));
    await act(async () => {
      await approvePromise;
    });

    expect(result.current.reminders[0].status).toBe("suggested");
    expect(result.current.error).toBe("Approval failed");
  });
});

function mockFetch(...responses: Array<Response | Promise<Response>>) {
  const fetchMock = vi.fn<typeof fetch>();
  responses.forEach((response) => fetchMock.mockResolvedValueOnce(response as Response));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}
