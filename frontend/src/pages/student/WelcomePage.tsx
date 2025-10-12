import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "../../store/auth";

const WelcomePage = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const targetText = useMemo(
    () =>
      `亲爱的${user?.student_name ?? user?.username ?? ""}同学，欢迎来到小彩蝶劳动益美行评测环节，一起来看看经历了小彩蝶劳动计划的你有哪些成长吧！`,
    [user],
  );
  const [displayText, setDisplayText] = useState("");

  useEffect(() => {
    let index = 0;
    const timer = setInterval(() => {
      setDisplayText(targetText.slice(0, index + 1));
      index += 1;
      if (index >= targetText.length) {
        clearInterval(timer);
      }
    }, 60);
    return () => clearInterval(timer);
  }, [targetText]);

  return (
    <Stack spacing={4}>
      <Paper
        elevation={8}
        sx={{
          borderRadius: 4,
          padding: 6,
          background:
            "linear-gradient(135deg, rgba(255,182,193,0.3), rgba(255,228,181,0.3))",
        }}
      >
        <Typography variant="h5" fontWeight={600} lineHeight={2}>
          {displayText}
        </Typography>
      </Paper>
      <Box textAlign="center">
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={() => navigate("/student/survey")}
        >
          开始自我评价
        </Button>
      </Box>
    </Stack>
  );
};

export default WelcomePage;
