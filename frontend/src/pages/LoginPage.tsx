import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import client from "../api/client";
import { useAuthStore } from "../store/auth";
import { toastError, toastSuccess } from "../components/toast";

type LoginIdentity = "" | "student" | "teacher";

const LoginPage = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [identity, setIdentity] = useState<LoginIdentity>("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (event?: React.FormEvent<HTMLFormElement>) => {
     event?.preventDefault();
    if (!identity) {
      toastError("请选择身份后再登录");
      return;
    }
    if (!username || !password) {
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await client.post("/auth/login", {
        identity,
        username,
        password,
      });
      setAuth({
        token: data.access_token,
        role: data.role,
        sessionId: data.session_id,
        user: data.user,
      });
      toastSuccess("登录成功，开始评测！");
      if (data.role === "student") {
        navigate("/student/welcome", { replace: true });
      } else if (data.role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/teacher", { replace: true });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box

      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        background: "linear-gradient(135deg, #ffe0f0 0%, #fef3c7 100%)",
        padding: { xs: 2, sm: 4 },
      }}
    >
      <Paper
        elevation={6}
        sx={{
          width: "100%",
          maxWidth: 420,
          margin: "0 auto",
          padding: 4,
          borderRadius: 4,
        }}
      >
        <Box
            component="form"
            onSubmit={handleLogin}
            noValidate
        >
          <Stack spacing={3}>
            <Box textAlign="center">
              <Typography variant="h4" fontWeight={700} color="primary">
                小彩蝶劳动益美行评测
              </Typography>
              
            </Box>
            <FormControl fullWidth>
              <InputLabel id="identity-label" shrink>身份</InputLabel>
              <Select
                labelId="identity-label"
                value={identity}
                label="身份"
                displayEmpty
                renderValue={(value) => {
                  if (!value) {
                    return (
                      <Typography color="text.secondary">
                        请选择你的身份
                      </Typography>
                    );
                  }
                  return value === "student" ? "学生与家长" : "教师";
                }}
                onChange={(event) =>
                  setIdentity(event.target.value as LoginIdentity)
                }
              >
                <MenuItem value="" disabled sx={{ display: "none" }}>
                  <em>请选择你的身份</em>
                </MenuItem>
                <MenuItem value="student">学生与家长</MenuItem>
                <MenuItem value="teacher">教师</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="账号"
              fullWidth
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
            <TextField
              label="密码"
              fullWidth
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              InputProps={{
                endAdornment: password ? (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? "隐藏密码" : "显示密码"}
                      onClick={() => setShowPassword((prev) => !prev)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
              sx={{
                "& input::-ms-reveal, & input::-ms-clear": { display: "none" },
                "& input::-webkit-credentials-auto-fill-button": { display: "none" },
              }}
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              disabled={submitting}
            >
              登录
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
};

export default LoginPage;
