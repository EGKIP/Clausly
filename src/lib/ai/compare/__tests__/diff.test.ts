import { describe, expect, it } from "vitest";
import { textDiff } from "../diff";

describe("textDiff", () => {
  it("marks added words", () => {
    expect(textDiff("Rent is due.", "Rent is due monthly.")).toEqual([
      { type: "equal", value: "Rent is due " },
      { type: "add", value: "monthly" },
      { type: "equal", value: "." },
    ]);
  });

  it("marks removed words", () => {
    expect(textDiff("Notice is due monthly.", "Notice is due.")).toEqual([
      { type: "equal", value: "Notice is due" },
      { type: "remove", value: " monthly" },
      { type: "equal", value: "." },
    ]);
  });

  it("keeps equal text as a single equal segment", () => {
    expect(textDiff("No assignment without consent.", "No assignment without consent.")).toEqual([
      { type: "equal", value: "No assignment without consent." },
    ]);
  });

  it("marks mixed word-level changes", () => {
    expect(textDiff("Tenant gives 30 days notice.", "Tenant gives 60 days written notice.")).toEqual([
      { type: "equal", value: "Tenant gives " },
      { type: "remove", value: "30" },
      { type: "add", value: "60" },
      { type: "equal", value: " days " },
      { type: "add", value: "written " },
      { type: "equal", value: "notice." },
    ]);
  });
});
