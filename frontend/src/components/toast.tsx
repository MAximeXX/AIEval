import { Snackbar, Alert } from "@mui/material";
import React, { createContext, useContext, useMemo, useState } from "react";

type ToastState = {
  open: boolean;
  message: string;
  severity: "success" | "error" | "info" | "warning";
};

type ToastContextValue = {
  show: (message: string, severity?: ToastState["severity"]) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<ToastState>({
    open: false,
    message: "",
    severity: "info",
  });

  const value = useMemo<ToastContextValue>(
    () => ({
      show: (message, severity = "info") => {
        setState({ open: true, message, severity });
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        open={state.open}
        autoHideDuration={4000}
        onClose={() => setState((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={state.severity}
          onClose={() => setState((prev) => ({ ...prev, open: false }))}
          sx={{ width: "100%" }}
        >
          {state.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast 必须在 ToastProvider 内部使用");
  }
  return ctx;
};

let externalToast: ToastContextValue | null = null;

export const ToastBridge: React.FC = () => {
  const ctx = useToast();
  externalToast = ctx;
  return null;
};

export const toastInfo = (message: string) => {
  externalToast?.show(message, "info");
};

export const toastSuccess = (message: string) => {
  externalToast?.show(message, "success");
};

export const toastError = (message: string) => {
  externalToast?.show(message, "error");
};
