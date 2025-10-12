import {
  AppBar,
  Box,
  Card,
  CardContent,
  Container,
  Grid,
  Stack,
  Toolbar,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Divider,
} from "@mui/material";
import EmojiNatureIcon from "@mui/icons-material/EmojiNature";
import LogoutIcon from "@mui/icons-material/Logout";
import ReactECharts from "echarts-for-react";
import { useEffect, useMemo, useState } from "react";

import client from "../../api/client";
import { useAuthStore } from "../../store/auth";

type ProgressItem = {
  school_name: string;
  grade: number;
  class_no: string;
  total: number;
  completed: number;
};

type ChartA = Record<
  string,
  {
    stages: string[];
    series: Record<string, number[]>;
  }
>;

type ChartLine = Record<string, Record<string, number>>;

const AdminDashboard = () => {
  const clearAuth = useAuthStore((state) => state.clear);
  const user = useAuthStore((state) => state.user);
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [chartA, setChartA] = useState<ChartA>({});
  const [chartB, setChartB] = useState<ChartLine>({});
  const [chartC, setChartC] = useState<ChartLine>({});

  useEffect(() => {
    const load = async () => {
      const [{ data: progressData }, { data: charts }] = await Promise.all([
        client.get("/admin/progress"),
        client.get("/admin/charts"),
      ]);
      setProgress(progressData.progress ?? []);
      setChartA(charts.chart_a ?? {});
      setChartB(charts.chart_b ?? {});
      setChartC(charts.chart_c ?? {});
    };
    load();
  }, []);

  const groupedProgress = useMemo(() => {
    const map = new Map<string, ProgressItem[]>();
    progress.forEach((item) => {
      const key = `${item.grade}年级`;
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    });
    return Array.from(map.entries());
  }, [progress]);

  const handleLogout = async () => {
    try {
      await client.post("/auth/logout");
    } catch (error) {
      // ignore
    }
    clearAuth();
    window.location.href = "/login";
  };

  const renderChartA = (metric: string, data: ChartA[string]) => {
    const gradeNames = {
      low: "低年级",
      mid: "中年级",
      high: "高年级",
    } as Record<string, string>;
    return {
      tooltip: { trigger: "axis" },
      legend: {
        data: Object.keys(data.series).map((key) => gradeNames[key] ?? key),
      },
      xAxis: {
        type: "category",
        data: data.stages,
        name: "阶段",
        boundaryGap: false,
      },
      yAxis: {
        type: "value",
        name: "平均分",
      },
      series: Object.entries(data.series).map(([band, values]) => ({
        name: gradeNames[band] ?? band,
        type: "line",
        smooth: true,
        data: values,
      })),
    };
  };

  const renderLineChart = (title: string, lines: ChartLine) => {
    const bandNames = {
      low: "低年级",
      mid: "中年级",
      high: "高年级",
    } as Record<string, string>;
    const phases = ["原来", "现在"];
    return {
      title: { text: title, left: "center", textStyle: { fontSize: 14 } },
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category",
        data: phases,
        boundaryGap: false,
      },
      yAxis: { type: "value", name: "平均分" },
      series: Object.entries(lines).map(([band, values]) => ({
        name: bandNames[band] ?? band,
        type: "line",
        smooth: true,
        data: phases.map((phase) => values?.[phase] ?? 0),
      })),
    };
  };

  return (
    <Box sx={{ backgroundColor: "#f0f9ff", minHeight: "100vh" }}>
      <AppBar position="sticky" color="transparent" elevation={0}>
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <EmojiNatureIcon color="primary" />
            <Typography variant="h6" color="primary" fontWeight={700}>
              管理员驾驶舱
            </Typography>
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography color="text.secondary">
              {user?.username} 管理员
            </Typography>
            <Button
              startIcon={<LogoutIcon />}
              variant="outlined"
              onClick={handleLogout}
            >
              退出系统
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <Paper elevation={3} sx={{ borderRadius: 3, overflow: "hidden" }}>
              <Box px={3} py={2}>
                <Typography variant="h6" fontWeight={600}>
                  信息收集进度
                </Typography>
              </Box>
              <Divider />
              <Box px={3} py={2}>
                {groupedProgress.map(([grade, items]) => (
                  <Box key={grade} mb={3}>
                    <Typography fontWeight={600} mb={1}>
                      {grade}
                    </Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>班级</TableCell>
                          <TableCell>完成情况</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={`${item.grade}-${item.class_no}`}>
                            <TableCell>{item.class_no}班</TableCell>
                            <TableCell>
                              {item.completed}/{item.total}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Box>
                ))}
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12} md={7}>
            <Stack spacing={3}>
              {Object.entries(chartA).map(([metric, data]) => (
                <Card key={metric}>
                  <CardContent>
                    <Typography variant="h6" mb={2} fontWeight={600}>
                      {metric}平均自评走势
                    </Typography>
                    <ReactECharts option={renderChartA(metric, data)} />
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <ReactECharts
                  option={renderLineChart("劳动参与率对比", chartB)}
                />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <ReactECharts
                  option={renderLineChart("劳动习惯养成率对比", chartC)}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default AdminDashboard;
