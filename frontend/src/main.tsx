import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { CssBaseline, ThemeProvider } from "@mui/material";

import App from "./App";
import theme from "./theme";
import { ToastBridge, ToastProvider } from "./components/toast";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <ThemeProvider theme={theme}>
    <CssBaseline />
    <ToastProvider>
      <BrowserRouter>
        <App />
        <ToastBridge />
      </BrowserRouter>
    </ToastProvider>
  </ThemeProvider>,
);
