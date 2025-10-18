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

  const subtitle = useMemo(() => {
    if (!user) {
      return "";
    }
    if (user.role === "admin") {
      return `管理员：${user.teacher_name ?? user.username ?? ""}`;
    }
    const classLabel = user.class_no ? `${user.class_no}班` : "";
    return `${user.teacher_name ?? user.username ?? ""} ${classLabel}`.trim();
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
    <Box sx={{ minHeight: "100vh", backgroundColor: "#fff7f0" }}>
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
                小彩蝶劳动益美行评测
              </Typography>
            </Stack>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              spacing={1.5}
              alignItems={{ xs: "flex-start", sm: "center" }}
            >
              <Typography color="text.secondary">{subtitle}</Typography>
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
