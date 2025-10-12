import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    primary: {
      main: "#ff8a80",
    },
    secondary: {
      main: "#ffcc80",
    },
    background: {
      default: "#fff7f0",
      paper: "#ffffff",
    },
  },
  typography: {
    fontFamily: [
      "Noto Sans SC",
      "PingFang SC",
      "Microsoft YaHei",
      "sans-serif",
    ].join(","),
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          textTransform: "none",
          fontWeight: 600,
        },
      },
    },
  },
});

export default theme;
