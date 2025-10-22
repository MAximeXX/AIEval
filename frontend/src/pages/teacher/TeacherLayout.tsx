import LogoutIcon from "@mui/icons-material/Logout";
import EmojiNatureIcon from "@mui/icons-material/EmojiNature";
import { Box, Button, Container, Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import client from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { toastInfo } from "../../components/toast";

const TeacherLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, clear } = useAuthStore();

  const greetingMessage = useMemo(() => {
    if (!user) {
      return "";
    }

    const teacherName = (user.teacher_name ?? user.username ?? "").trim();
    if (user.role === "admin") {
      const adminLabel = teacherName ? `管理员${teacherName}` : "管理员";
      return `😊欢迎您，${adminLabel}！`;
    }

    const displayName = teacherName || user.username || "";
    if (displayName) {
      return `😊欢迎您，${displayName}老师！`;
    }
    return "😊欢迎您，老师！";
  }, [user]);

  const handleLogout = async () => {
    const hasUnsaved =
      (window as any).__teacherDirtyGuard || (window as any).__surveyDirtyGuard;
    if (hasUnsaved) {
      const ok = window.confirm("检测到问卷信息有修改，请先保存后再退出哦~");
      if (!ok) {
        return;
      }
    }
    try {
      await client.post("/auth/logout");
    } catch (error) {
      // ignore logout errors
    }
    clear();
    toastInfo("已退出系统，再见啦~");
    navigate("/login", { replace: true, state: { from: location } });
  };

  return (
    <Box sx={{ minHeight: "100vh", backgroundColor: "#f0f9ff" }}>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={4}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            alignItems={{ xs: "flex-start", md: "center" }}
            justifyContent="space-between"
            spacing={2}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <EmojiNatureIcon color="primary" />
              <Typography variant="h6" color="primary" fontWeight={700}>
                南湖“小彩蝶”劳动益“美”行——蝶宝劳动成长评价
              </Typography>
            </Stack>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              alignItems={{ xs: "flex-start", sm: "center" }}
            >
              <Typography color="text.secondary">
                {greetingMessage}
              </Typography>
              <Button
                startIcon={<LogoutIcon />}
                color="primary"
                variant="outlined"
                onClick={handleLogout}
              >
                退出系统
              </Button>
            </Stack>
          </Stack>

          <Box>
            <Outlet />
          </Box>
        </Stack>
      </Container>
    </Box>
  );
};

export default TeacherLayout;
