/* eslint-disable react-refresh/only-export-components */
import * as React from "react";

type ToastVariant = "default" | "destructive";

export type ToastData = {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastContextValue = {
  toasts: ToastData[];
  toast: (t: Omit<ToastData, "id">) => void;
  dismiss: (id: string) => void;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

function id() {
  return Math.random().toString(36).slice(2);
}

export function ToastProviderState({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const dismiss = React.useCallback((toastId: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  }, []);

  const toast = React.useCallback((t: Omit<ToastData, "id">) => {
    const toastId = id();
    const next: ToastData = { id: toastId, duration: 3000, variant: "default", ...t };
    setToasts((prev) => [...prev, next]);
  }, []);

  const value = React.useMemo(() => ({ toasts, toast, dismiss }), [toasts, toast, dismiss]);

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProviderState");
  }
  return ctx;
}
