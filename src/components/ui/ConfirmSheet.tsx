"use client";
import { useState } from "react";
import BottomSheet from "./BottomSheet";
import Button from "./Button";

export default function ConfirmSheet({
  open,
  title,
  description,
  confirmLabel,
  danger,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const isLoading = loading || busy;

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } catch (error) {
      setBusy(false);
      throw error;
    }
    setBusy(false);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.5 }}>
          {description}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Button
            type="button"
            variant={danger ? "danger" : "brand"}
            size="lg"
            fullWidth
            loading={isLoading}
            onClick={confirm}
          >
            {confirmLabel}
          </Button>
          <Button type="button" variant="outline" size="lg" fullWidth disabled={isLoading} onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
