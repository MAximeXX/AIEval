import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Paper,
  Stack,
  Typography,
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
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [chartA, setChartA] = useState<ChartA>({});
  const [chartB, setChartB] = useState<ChartLine>({});
  const [chartC, setChartC] = useState<ChartLine>({});
  const [overallB, setOverallB] = useState<Record<string, number>>({});
  const [overallC, setOverallC] = useState<Record<string, number>>({});

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
      setOverallB(charts.overall_b ?? {});
      setOverallC(charts.overall_c ?? {});
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

  const gradeOrder = [1, 2, 3, 4, 5, 6];
  const gradeColumns = gradeOrder.map((grade) => {
    const label = `${grade}年级`;
    const items =
      groupedProgress.find(([key]) => key === label)?.[1] ?? [];
    return { grade, label, items };
  });
  const maxRows = Math.max(
    1,
    ...gradeColumns.map((column) => column.items.length),
  );
  const rowHeight = 56;

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

  const renderLineChart = (
    title: string,
    lineValues: Record<string, number>,
  ) => {
    const phases = ["原来", "现在"];
    const positions = [15, 85];

    return {
      title: { text: title, left: "center", textStyle: { fontSize: 14 } },
      tooltip: {
        trigger: "item",
        formatter: ({ value }: { value: [number, number] | number }) => {
          const score = Array.isArray(value) ? value[1] : value;
          return `平均分：${score}%`;
        },
      },
      xAxis: {
        type: "value",
        min: 0,
        max: 100,
        boundaryGap: ["5%", "5%"],
        axisLabel: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
      },
      yAxis: { type: "value", name: "百分比（%）" },
      series: [
        {
          name: "全校",
          type: "line",
          smooth: true,
          showSymbol: true,
          symbolSize: 10,
          label: {
            show: true,
            position: "top",
            formatter: ({ value }: { value: [number, number] | number }) => {
              const score = Array.isArray(value) ? value[1] : value;
              return `${score}%`;
            },
          },
          emphasis: { focus: "series" },
          data: phases.map((phase, index) => [
            positions[index],
            lineValues[phase] ?? 0,
          ]),
        },
      ],
      grid: { left: 50, right: 30, bottom: 70, top: 60 },
      graphic: [
        {
          type: "text",
          left: "21%",
          bottom: 50,
          style: {
            text: "原来",
            fill: "#666",
            fontSize: 12,
          },
        },
        {
          type: "text",
          left: "79%",
          bottom: 50,
          style: {
            text: "现在",
            fill: "#666",
            fontSize: 12,
          },
        },
      ],
    };
  };


  return (
    <Box sx={{ backgroundColor: "#f0f9ff", minHeight: "100vh" }}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
        sx={{ py: 3, px: 4 }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <EmojiNatureIcon color="primary" />
          <Typography variant="h6" color="primary" fontWeight={700}>
            全校信息汇总
          </Typography>
        </Stack>
        <Button
          startIcon={<LogoutIcon />}
          variant="outlined"
          onClick={handleLogout}
        >
          退出系统
        </Button>
      </Stack>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ borderRadius: 3, p: 3 }}>
              <Typography variant="h6" fontWeight={600} mb={3}>
                信息收集进度
              </Typography>
              <Box display="grid" gridTemplateColumns="repeat(6, minmax(0, 1fr))" gap={2}>
                {gradeColumns.map((column) => (
                  <Paper
                    key={column.grade}
                    elevation={1}
                    sx={{
                      borderRadius: 2,
                      p: 2,
                      minHeight: maxRows * rowHeight + 40,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <Typography align="center" fontWeight={700} color="primary" mb={1}>
                      {column.label}
                    </Typography>
                    <Stack spacing={1} sx={{ flex: 1 }}>
                      {column.items.map((item) => (
                        <Box
                          key={`${item.grade}-${item.class_no}`}
                          sx={{
                            borderRadius: 1,
                            px: 1.5,
                            py: 1,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            backgroundColor: "rgba(14, 165, 233, 0.08)",
                          }}
                        >
                          <Typography fontWeight={600}>{item.class_no}班</Typography>
                          <Typography color="primary" fontWeight={700}>
                            {item.completed}/{item.total}
                          </Typography>
                        </Box>
                      ))}
                      {Array.from({ length: Math.max(0, maxRows - column.items.length) }).map((_, index) => (
                        <Box key={index} sx={{ minHeight: rowHeight - 16 }} />
                      ))}
                    </Stack>
                  </Paper>
                ))}
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <Grid container spacing={3}>
              {Object.entries(chartA).map(([metric, data]) => (
                <Grid item xs={12} md={4} key={metric}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" mb={2} fontWeight={600}>
                        {metric}
                      </Typography>
                      <ReactECharts option={renderChartA(metric, data)} />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>

          <Grid item xs={12}>
            <Grid container spacing={3} justifyContent="center">
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <ReactECharts option={renderLineChart("劳动参与率走势", overallB)} />
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <ReactECharts
                      option={renderLineChart("劳动习惯养成率走势", overallC)}
                    />
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default AdminDashboard;
