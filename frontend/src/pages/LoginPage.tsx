import {
  Box,
  Button,
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import client from "../api/client";
import { useAuthStore } from "../store/auth";
import { toastSuccess } from "../components/toast";

const LoginPage = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [identity, setIdentity] = useState<"student" | "teacher">("student");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async () => {
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
      toastSuccess("登录成功，欢迎开始评测！");
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
    <Container
      component="main"
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        background: "linear-gradient(135deg, #ffe0f0 0%, #fef3c7 100%)",
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
        <Stack spacing={3}>
          <Box textAlign="center">
            <Typography variant="h4" fontWeight={700} color="primary">
              小彩蝶劳动益美行评测
            </Typography>
            <Typography color="text.secondary" mt={1}>
              请选择身份登录，开启充满成长的劳动旅程
            </Typography>
          </Box>
          <FormControl fullWidth>
            <InputLabel id="identity-label">身份</InputLabel>
            <Select
              labelId="identity-label"
              value={identity}
              label="身份"
              onChange={(event) =>
                setIdentity(event.target.value as "student" | "teacher")
              }
            >
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
            type="password"
            fullWidth
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <Button
            variant="contained"
            size="large"
            fullWidth
            disabled={submitting}
            onClick={handleLogin}
          >
            开始登录
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
};

export default LoginPage;
