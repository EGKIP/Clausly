"use client";

import * as React from "react";
import { Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const SRC = "/video/clausly-tour-30s.mp4";
const POSTER = "/video/clausly-tour-poster.jpg";

/* "Watch the 30s tour": opens the product film in a native <dialog> (focus trap + Esc for free).
 * The video element is only mounted while open, so nothing is downloaded until someone asks for it. */
export function WatchTourButton({ className }: { className?: string }) {
  const dialogRef = React.useRef<HTMLDialogElement>(null);
  const [open, setOpen] = React.useState(false);

  function show() {
    setOpen(true);
    dialogRef.current?.showModal();
  }

  return (
    <>
      <Button variant="ghost" size="lg" onClick={show} className={className}>
        <Play className="size-4 fill-current" />
        Watch the 30s tour
      </Button>

      <dialog
        ref={dialogRef}
        aria-label="Clausly 30-second product tour"
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
        className="m-auto w-[min(92vw,960px)] overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-black p-0 text-white shadow-2xl backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Close video"
          className="absolute right-3 top-3 z-10 inline-flex size-9 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="size-4" />
        </button>
        {open && (
          <video
            className="aspect-video w-full bg-black"
            src={SRC}
            poster={POSTER}
            controls
            autoPlay
            playsInline
            preload="metadata"
            aria-label="Clausly product tour. A 30-second film with music and no narration."
          />
        )}
      </dialog>
    </>
  );
}
