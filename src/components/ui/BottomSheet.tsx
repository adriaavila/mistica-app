"use client";
import React, { useEffect, useId, useRef } from "react";

export default function BottomSheet({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }} onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} style={{
        position: "relative", background: "var(--white)",
        borderRadius: "28px 28px 0 0",
        maxHeight: "92vh", overflowY: "auto", overscrollBehavior: "contain",
        maxWidth: 480, width: "100%", margin: "0 auto",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.15)",
      }}>
        <div style={{ padding: "12px 20px 0", display: "flex", justifyContent: "center" }}>
          <div style={{ width: 36, height: 4, background: "var(--border)", borderRadius: 99 }} />
        </div>
        <div style={{ padding: "14px 20px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)" }}>
          <span id={titleId} style={{ fontSize: 17, fontWeight: 700, fontFamily: "var(--font)", color: "var(--text-primary)" }}>{title}</span>
          <button
            ref={closeRef}
            type="button"
            aria-label="Cerrar"
            onClick={onClose}
            onFocus={e => { e.currentTarget.style.boxShadow = "var(--shadow-focus)"; }}
            onBlur={e => { e.currentTarget.style.boxShadow = "none"; }}
            style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface-2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: "var(--text-secondary)", transition: "box-shadow 0.15s ease" }}
          >✕</button>
        </div>
        <div style={{ padding: "20px 20px calc(20px + env(safe-area-inset-bottom))" }}>{children}</div>
      </div>
    </div>
  );
}
