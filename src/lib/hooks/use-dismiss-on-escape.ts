"use client";

import * as React from "react";

/** Calls `onDismiss` when Escape is pressed while `active` is true, matching the
 * WAI-ARIA dialog pattern (https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/). */
export function useDismissOnEscape(active: boolean, onDismiss: () => void) {
  React.useEffect(() => {
    if (!active) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [active, onDismiss]);
}
