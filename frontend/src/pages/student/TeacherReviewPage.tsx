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

const TeacherReviewPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await client.get("/students/me/teacher-review");
        setContent(data.rendered_text);
      } catch (error: any) {
        const message =
          error?.response?.data?.detail ??
          "老师还未对你做出评价哦，请耐心等待~";
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
        <CircularProgress />
        <Typography mt={2}>彩小蝶正在为你寻找老师的点评...</Typography>
      </Stack>
    );
  }

  const isPending =
    content === "老师还未对你做出评价哦，请耐心等待~";

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={2}>
            老师对你的评价
          </Typography>
          <Typography
            sx={{
              whiteSpace: "pre-wrap",
              lineHeight: 2,
              color: isPending ? "text.secondary" : "text.primary",
            }}
          >
            {content}
          </Typography>
        </CardContent>
      </Card>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Button variant="contained" onClick={() => navigate("/student/survey")}>
          返回问卷填写
        </Button>
        <Button
          variant="outlined"
          onClick={() => navigate("/student/ai")}
          disabled={isPending}
        >
          查看彩小蝶对你的综合评语
        </Button>
      </Stack>
    </Stack>
  );
};

export default TeacherReviewPage;
