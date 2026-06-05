"use client";

import * as React from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { UploadModal } from "./upload-modal";
import { CommandPalette } from "./command-palette";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [cmdOpen, setCmdOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      } else if (e.key === "Escape") {
        setCmdOpen(false);
        setUploadOpen(false);
        setMobileOpen(false);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "u") {
        e.preventDefault();
        setUploadOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--background)] flex">
      {/* Desktop sidebar */}
      <div className="hidden lg:block w-[260px] xl:w-[272px] shrink-0 h-screen sticky top-0">
        <Sidebar />
      </div>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="lg:hidden fixed inset-0 z-40 bg-[oklch(15%_0.02_260/0.4)] backdrop-blur-sm"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 340, damping: 36 }}
              className="lg:hidden fixed inset-y-0 left-0 z-50 w-[280px] shadow-[var(--shadow-float)]"
            >
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar
          onOpenSidebar={() => setMobileOpen(true)}
          onOpenUpload={() => setUploadOpen(true)}
          onOpenSearch={() => setCmdOpen(true)}
        />
        <main className="flex-1 min-w-0">{children}</main>
      </div>

      <UploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* ?upload=1 deep-link, isolated in a Suspense boundary so the layout
       * stays static. Used by /welcome and empty-state CTAs to open the modal. */}
      <React.Suspense fallback={null}>
        <UploadDeepLink onOpen={() => setUploadOpen(true)} />
      </React.Suspense>
    </div>
  );
}

function UploadDeepLink({ onOpen }: { onOpen: () => void }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  React.useEffect(() => {
    if (searchParams.get("upload") !== "1") return;
    onOpen();
    const next = new URLSearchParams(searchParams.toString());
    next.delete("upload");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [searchParams, pathname, router, onOpen]);
  return null;
}
