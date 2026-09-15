"use client";

import * as React from "react";

/** Calls `onDismiss` when a pointerdown lands outside the returned ref's element
 * while `active` is true. For popovers/dropdowns with no full-screen backdrop to
 * catch the click itself. */
export function useClickOutside<T extends HTMLElement>(active: boolean, onDismiss: () => void) {
  const ref = React.useRef<T>(null);

  React.useEffect(() => {
    if (!active) return;

    function handlePointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss();
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [active, onDismiss]);

  return ref;
}
