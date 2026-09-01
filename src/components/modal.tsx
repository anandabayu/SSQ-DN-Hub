"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "./ui";

/**
 * Built on the native <dialog> element, which gives focus trapping, Escape to
 * close, and the top-layer backdrop for free — all things a div-based modal
 * has to reimplement badly.
 */
export function Modal({
  trigger,
  title,
  children,
}: {
  trigger: ReactNode;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Escape closes the dialog natively, so mirror that back into React state.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    const onClose = () => setOpen(false);
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>

      <dialog
        ref={ref}
        // Clicking the backdrop lands on the dialog itself, never a child.
        onClick={(e) => e.target === ref.current && setOpen(false)}
        className="m-auto w-[min(56rem,calc(100vw-2rem))] rounded-xl border border-line bg-panel p-0 text-fg backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold tracking-wide text-fg uppercase">
            {title}
          </h2>
          <Button variant="ghost" onClick={() => setOpen(false)} aria-label="Close">
            &times;
          </Button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4 sm:p-5">{children}</div>
      </dialog>
    </>
  );
}
