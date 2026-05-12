"use client";

import { useEffect, useState } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-4 md:items-center">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-5 shadow-2xl">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {description ? <p className="mt-2 text-sm text-white/70">{description}</p> : null}
        <MotionConfirmActions
          cancelLabel={cancelLabel}
          confirmLabel={confirmLabel}
          danger={danger}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      </div>
    </div>
  );
}

function MotionConfirmActions({
  cancelLabel,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  cancelLabel: string;
  confirmLabel: string;
  danger: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/80 hover:bg-white/5"
      >
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className={`rounded-xl px-4 py-2 text-sm font-medium text-white ${
          danger ? "bg-red-600 hover:bg-red-500" : "bg-blue-600 hover:bg-blue-500"
        }`}
      >
        {confirmLabel}
      </button>
    </div>
  );
}

export function useConfirmDialog() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    danger?: boolean;
    resolve?: (value: boolean) => void;
  }>({ open: false, title: "" });

  const confirm = (options: {
    title: string;
    description?: string;
    confirmLabel?: string;
    danger?: boolean;
  }) =>
    new Promise<boolean>((resolve) => {
      setState({ open: true, ...options, resolve });
    });

  const dialog = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      description={state.description}
      confirmLabel={state.confirmLabel}
      danger={state.danger}
      onCancel={() => {
        state.resolve?.(false);
        setState((prev) => ({ ...prev, open: false }));
      }}
      onConfirm={() => {
        state.resolve?.(true);
        setState((prev) => ({ ...prev, open: false }));
      }}
    />
  );

  return { confirm, dialog };
}
