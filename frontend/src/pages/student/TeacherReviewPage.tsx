import {
  Button,
  Card,
  CardContent,
  CircularProgress,
  Box,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import client from "../../api/client";

const PENDING_MESSAGE = "老师还未对你做出评价哦，请耐心等待~";

const TeacherReviewPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<string | null>(null);
  const [displayText, setDisplayText] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await client.get("/students/me/teacher-review");
        const text = String(data.rendered_text ?? "");
        setContent(text);
      } catch (error: any) {
        const message =
          error?.response?.data?.detail ?? PENDING_MESSAGE;
        setContent(message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!content) {
      setDisplayText("");
      return;
    }
    if (content === PENDING_MESSAGE) {
      setDisplayText(content);
      return;
    }
    setDisplayText("");
    let index = 0;
    const timer = setInterval(() => {
      index += 1;
      setDisplayText(content.slice(0, index));
      if (index >= content.length) {
        clearInterval(timer);
      }
    }, 50);
    return () => clearInterval(timer);
  }, [content]);

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" minHeight="40vh">
        <CircularProgress />
        <Typography mt={2}>彩小蝶正在为你寻找老师的点评...</Typography>
      </Stack>
    );
  }

  const isPending = content === PENDING_MESSAGE;

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={2}>
            👩‍🏫老师对你的评价
          </Typography>
          <Box sx={{ pl: 11 }}>
            <Typography
              sx={{
                whiteSpace: "pre-wrap",
                lineHeight: 2,
                color: isPending ? "text.secondary" : "text.primary",
                textIndent: (theme) => `-${theme.spacing(11)}`,
              }}
            >
              {displayText || content || ""}
            </Typography>
          </Box>
        </CardContent>
      </Card>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Button variant="contained" onClick={() => navigate("/student/survey")}>
          ↩️返回问卷填写
        </Button>
        <Button
          variant="outlined"
          onClick={() => navigate("/student/ai")}
          disabled={isPending}
        >
          🦋查看彩小蝶对你的综合评语
        </Button>
      </Stack>
    </Stack>
  );
};

export default TeacherReviewPage;
