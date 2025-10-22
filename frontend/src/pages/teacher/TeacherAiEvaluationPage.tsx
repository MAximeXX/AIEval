import { Button, Card, CardContent, CircularProgress, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import client from "../../api/client";
import { toastError } from "../../components/toast";

const TeacherAiEvaluationPage = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<string | null>(null);
  const [displayText, setDisplayText] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      if (!studentId) {
        return;
      }
      setLoading(true);
      try {
        const { data } = await client.get(`/teacher/students/${studentId}/llm-eval`);
        setContent(data.content ?? "");
      } catch (error: any) {
        const message =
          error?.response?.data?.detail ?? "暂时无法获取综评，请稍后再试~";
        toastError(message);
        setContent(message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [studentId]);

  useEffect(() => {
    if (content === null) {
      setDisplayText("");
      return;
    }
    const segments = Array.from(content);
    if (segments.length === 0) {
      setDisplayText("");
      return;
    }
    setDisplayText(segments[0]);
    let index = 1;
    const timer = window.setInterval(() => {
      if (index >= segments.length) {
        window.clearInterval(timer);
        return;
      }
      setDisplayText(segments.slice(0, index + 1).join(""));
      index += 1;
    }, 70);

    return () => window.clearInterval(timer);
  }, [content]);

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" minHeight="40vh">
        <CircularProgress color="secondary" />
        <Typography mt={2}>🦋正在评估中......</Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={2}>
            🦋智能综评
          </Typography>
          <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 2 }}>
            {displayText || "暂未生成评语"}
          </Typography>
        </CardContent>
      </Card>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Button
          variant="contained"
          onClick={() => navigate(`/teacher/students/${studentId}`)}
        >
          返回查看问卷
        </Button>
        <Button variant="outlined" onClick={() => navigate("/teacher")}>
          返回班级列表
        </Button>
      </Stack>
    </Stack>
  );
};

export default TeacherAiEvaluationPage;
