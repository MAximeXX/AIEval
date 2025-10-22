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
import butterflyImage from "../../butterfly.png";
import butterflyGif from "../../butterfly.gif";

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
      if (data.role === "student") {
        toastSuccess("登录成功，开始评测！");
        navigate("/student/welcome", { replace: true });
      } else if (data.role === "admin") {
        toastSuccess("登陆成功！");
        navigate("/admin", { replace: true });
      } else {
        toastSuccess("登陆成功！");
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
        justifyContent: "center",
        backgroundImage: `url(${butterflyImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        padding: { xs: 2, sm: 4 },
      }}
    >
      <Paper
        elevation={6}
        sx={{
          width: "100%",
          maxWidth: 520,
          margin: "0 auto",
          padding: 4,
          borderRadius: 4,
          position: "relative",
          overflow: "visible",
          backgroundColor: "rgba(255, 255, 255, 0.88)",
          backdropFilter: "blur(1px)",
        }}
      >
        <Box
          component="img"
          src={butterflyGif}
          alt="蝴蝶装饰"
          sx={{
            position: "absolute",
            top: { xs: -180, sm: -240 },
            right: { xs: -180, sm: -240 },
            width: { xs: 360, sm: 480 },
            pointerEvents: "none",
            animation: "flutter 6s ease-in-out infinite",
            "@keyframes flutter": {
              "0%": { transform: "translateY(0) rotate(-2deg)" },
              "50%": { transform: "translateY(-12px) rotate(2deg)" },
              "100%": { transform: "translateY(0) rotate(-2deg)" },
            },
          }}
        />
        <Box
            component="form"
            onSubmit={handleLogin}
            noValidate
        >
          <Stack spacing={3}>
            <Box textAlign="center">
              <Typography
                variant="h4"
                fontWeight={700}
                color="primary"
                sx={{ whiteSpace: "nowrap" }}
              >
                南湖“小彩蝶”劳动益“美”行
              </Typography>
              <Typography
                variant="h6"
                color="primary"
                fontWeight={500}
                mt={1}
              >
                🦋蝶宝劳动成长评价
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
