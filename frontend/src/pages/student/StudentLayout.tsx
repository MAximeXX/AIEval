import { Box, Button, Container, Stack, Typography } from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import client from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { toastError, toastInfo } from "../../components/toast";

type Props = {
  children: React.ReactNode;
};

const StudentLayout = ({ children }: Props) => {
  const navigate = useNavigate();
  const { user, clear } = useAuthStore();
  const studentDisplayName =
    (user?.student_name ?? user?.username ?? "").trim();

  useEffect(() => {
    if (!user?.id) {
      (window as any).__studentLockStatus = false;
      return undefined;
    }
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    (window as any).__studentLockStatus = false;
    const socket = new WebSocket(
      `${protocol}://${window.location.host}/ws/student/${user.id}`,
    );
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === "lock_changed") {
          const locked = Boolean(payload.is_locked);
          (window as any).__studentLockStatus = locked;
          window.dispatchEvent(
            new CustomEvent("student-lock-changed", { detail: locked }),
          );
          if (payload.is_locked) {
            toastError("表格数据已被锁定，无法更改~");
          } else {
            toastInfo("老师已解锁，可以继续编辑啦~");
          }
        } else if (payload.event === "survey_overridden") {
          toastInfo("老师已更新你的问卷，请及时查看~");
        }
      } catch (error) {
        // ignore malformed message
      }
    };
    return () => {
      socket.close();
      (window as any).__studentLockStatus = false;
    };
  }, [user?.id]);

  const handleLogout = async () => {
    if ((window as any).__surveyDirtyGuard) {
      const ok = window.confirm("检测到问卷信息有修改，请注意保存！");
      if (!ok) {
        return;
      }
    }
    try {
      await client.post("/auth/logout");
    } catch (error) {
      // ignore
    }
    clear();
    (window as any).__studentLockStatus = false;
    toastInfo("已退出系统，期待再次与你相遇~");
    navigate("/login", { replace: true });
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
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography color="primary" sx={{ fontSize: "1.5rem" }}>
                🦋
              </Typography>
              <Typography variant="h6" color="primary" fontWeight={700}>
                南湖“小彩蝶”劳动益“美”行——蝶宝劳动成长评价
              </Typography>
            </Stack>
            <Stack
              direction={{ xs: "column", sm: "row" }}
              alignItems={{ xs: "flex-start", sm: "center" }}
              spacing={1.5}
            >
              <Typography color="text.secondary">
                😊欢迎你，{studentDisplayName}同学！
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

          <Box>{children}</Box>
        </Stack>
      </Container>
    </Box>
  );
};

export default StudentLayout;
