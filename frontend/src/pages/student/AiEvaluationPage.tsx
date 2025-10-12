import {
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import client from "../../api/client";
import { toastError } from "../../components/toast";

const AiEvaluationPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await client.post("/students/me/llm-eval");
        setContent(data.content);
      } catch (error: any) {
        const message =
          error?.response?.data?.detail ?? "暂时无法生成，请稍后再试";
        toastError(message);
        setContent(message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" minHeight="40vh">
        <CircularProgress color="secondary" />
        <Typography mt={2}>彩小蝶正在评估中......</Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={2}>
            彩小蝶对你的综合评语
          </Typography>
          <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 2 }}>
            {content}
          </Typography>
        </CardContent>
      </Card>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Button variant="contained" onClick={() => navigate("/student/survey")}>
          返回问卷填写
        </Button>
        <Button variant="outlined" onClick={() => navigate("/student/review")}>
          查看老师对你的评价
        </Button>
      </Stack>
    </Stack>
  );
};

export default AiEvaluationPage;
