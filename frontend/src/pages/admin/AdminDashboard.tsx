import {
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Fade,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Popper,
  Stack,
  Typography,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import ReactECharts from "echarts-for-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

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

type GradeBandKey = "low" | "mid" | "high";

const STAGE_POSITIONS: number[] = [15, 50, 85];

type TeacherStudentRow = {
  student_id: string;
  student_no: string | null;
  student_name: string;
  class_no: string | null;
  grade: number;
  grade_band: string;
};

const BAND_CONFIG: Record<
  GradeBandKey,
  { label: string; color: string }
> = {
  low: { label: "低年级", color: "#5B8FF9" },
  mid: { label: "中年级", color: "#52C41A" },
  high: { label: "高年级", color: "#FAAD14" },
};

const CHART_HEIGHT = 320;

const AdminDashboard = () => {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((state) => state.clear);
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [chartA, setChartA] = useState<ChartA>({});
  const [chartB, setChartB] = useState<ChartLine>({});
  const [chartC, setChartC] = useState<ChartLine>({});
  const [overallB, setOverallB] = useState<Record<string, number>>({});
  const [overallC, setOverallC] = useState<Record<string, number>>({});
  const [studentsByClass, setStudentsByClass] = useState<
    Record<string, TeacherStudentRow[]>
  >({});
  const [dropdownAnchor, setDropdownAnchor] = useState<HTMLElement | null>(null);
  const [openClassKey, setOpenClassKey] = useState<string | null>(null);
  const popperRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const loadStudents = async () => {
      try {
        const { data } = await client.get<TeacherStudentRow[]>(
          "/teacher/class/students",
        );
        const grouped: Record<string, TeacherStudentRow[]> = {};
        data.forEach((item) => {
          const key = `${item.grade ?? ""}-${(item.class_no ?? "").trim()}`;
          if (!grouped[key]) {
            grouped[key] = [];
          }
          grouped[key].push(item);
        });
        Object.keys(grouped).forEach((key) => {
          grouped[key].sort((a, b) => {
            const aNo = a.student_no ?? "";
            const bNo = b.student_no ?? "";
            return aNo.localeCompare(bNo, "zh-CN");
          });
        });
        setStudentsByClass(grouped);
      } catch {
        // ignore loading errors; overlay will simply show empty state
      }
    };
    loadStudents();
  }, []);

  const buildClassKey = useCallback(
    (grade: number, classNo: string | null | undefined) =>
      `${grade ?? ""}-${(classNo ?? "").trim()}`,
    [],
  );

  const studentsForDropdown = useMemo(() => {
    if (!openClassKey) {
      return [];
    }
    return studentsByClass[openClassKey] ?? [];
  }, [openClassKey, studentsByClass]);

  const handleCloseDropdown = useCallback(() => {
    setOpenClassKey(null);
    setDropdownAnchor(null);
    sessionStorage.removeItem("adminClassDropdown");
  }, []);

  const handleClassClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>, grade: number, classNo: string) => {
      const key = buildClassKey(grade, classNo);
      if (openClassKey === key) {
        handleCloseDropdown();
        return;
      }
      setDropdownAnchor(event.currentTarget);
      setOpenClassKey(key);
      sessionStorage.setItem("adminClassDropdown", key);
    },
    [buildClassKey, handleCloseDropdown, openClassKey],
  );

  const handleStudentNavigate = useCallback(
    (studentId: string) => {
      if (openClassKey) {
        sessionStorage.setItem("adminClassDropdown", openClassKey);
      }
      navigate(`/admin/students/${studentId}`);
    },
    [navigate, openClassKey],
  );

  useEffect(() => {
    if (!openClassKey) {
      return;
    }
    const handleClickAway = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }
      if (
        dropdownAnchor?.contains(target) ||
        popperRef.current?.contains(target)
      ) {
        return;
      }
      handleCloseDropdown();
    };
    document.addEventListener("mousedown", handleClickAway);
    return () => document.removeEventListener("mousedown", handleClickAway);
  }, [dropdownAnchor, handleCloseDropdown, openClassKey]);

  useEffect(() => {
    const storedKey = sessionStorage.getItem("adminClassDropdown");
    if (!storedKey) {
      return;
    }
    if (!studentsByClass[storedKey]) {
      if (Object.keys(studentsByClass).length > 0) {
        sessionStorage.removeItem("adminClassDropdown");
      }
      return;
    }
    const element = document.querySelector<HTMLElement>(
      `[data-class-key="${storedKey}"]`,
    );
    if (element) {
      setDropdownAnchor(element);
      setOpenClassKey(storedKey);
    }
  }, [studentsByClass]);

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
    const key = `${grade}年级`;
    const labelMap: Record<number, string> = {
      1: "一年级",
      2: "二年级",
      3: "三年级",
      4: "四年级",
      5: "五年级",
      6: "六年级",
    };
    const label = labelMap[grade] ?? key;
    const items =
      groupedProgress.find(([progressKey]) => progressKey === key)?.[1] ?? [];
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

  const renderChartA = (_metric: string, data: ChartA[string]) => {
    const buildSeriesData = (
      band: GradeBandKey,
      values: number[],
    ): Array<{ value: [number, number] }> => {
      const sanitized = values
        .slice(0, STAGE_POSITIONS.length)
        .map((item) => (Number.isFinite(item) ? Number(item) : 0));
      if (band === "low") {
        const third = Math.round(sanitized[2] ?? 0);
        const second = Math.round(sanitized[1] ?? 0);
        const first = Math.round(sanitized[0] ?? 0);
        if (
          third === 0 &&
          (second !== 0 || sanitized.length <= 2)
        ) {
          return [
            { value: [STAGE_POSITIONS[0], first] },
            { value: [STAGE_POSITIONS[2], second] },
          ];
        }
      }
      return sanitized.map((item, index) => ({
        value: [
          STAGE_POSITIONS[
            Math.min(index, STAGE_POSITIONS.length - 1)
          ],
          Math.round(item),
        ],
      }));
    };

    const series = (Object.keys(BAND_CONFIG) as GradeBandKey[]).map(
      (bandKey) => {
        const { label, color } = BAND_CONFIG[bandKey];
        const rawValues = data?.series?.[bandKey] ?? [];
        const points = buildSeriesData(bandKey, rawValues);
        return {
          name: label,
          type: "line" as const,
          symbol: "circle",
          symbolSize: 8,
          smooth: false,
          connectNulls: true,
          lineStyle: { color, width: 3 },
          itemStyle: { color },
          label: {
            show: true,
            position: "top",
            color,
            fontWeight: 600,
            formatter: ({ value }: { value: [number, number] | number }) => {
              if (Array.isArray(value)) {
                return `${Math.round(value[1])}`;
              }
              return `${Math.round(value)}`;
            },
          },
          data: points,
          tooltip: { show: false },
        };
      },
    );

    return {
      tooltip: { show: false },
      color: Object.values(BAND_CONFIG).map(({ color }) => color),
      legend: {
        data: Object.values(BAND_CONFIG).map(({ label }) => label),
        bottom: 10,
        icon: "circle",
        itemWidth: 10,
        itemHeight: 10,
      },
      grid: { left: 48, right: 24, top: 40, bottom: 50 },
      xAxis: {
        type: "value",
        min: 0,
        max: 100,
        axisLabel: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLine: {
          lineStyle: { color: "#94A3B8" },
        },
      },
      yAxis: {
        type: "value",
        name: "平均分",
        min: 0,
        max: 100,
        axisLine: {
          lineStyle: { color: "#94A3B8" },
        },
        splitLine: {
          lineStyle: { type: "dashed", color: "#E2E8F0" },
        },
      },
      series,
    };
  };

  const renderLineChart = (_: string, lineValues: Record<string, number>) => {
    const phases = ["原来", "现在"];
    const positions = [15, 85];

    return {
      title: { show: false },
      tooltip: { show: false },
      xAxis: {
        type: "value",
        min: 0,
        max: 100,
        boundaryGap: ["5%", "5%"],
        axisLabel: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLine: {
          lineStyle: { color: "#94A3B8" },
        },
      },
      yAxis: {
        type: "value",
        name: "百分比（%）",
        min: 0,
        max: 100,
        axisLine: {
          lineStyle: { color: "#94A3B8" },
        },
        splitLine: {
          lineStyle: { type: "dashed", color: "#E2E8F0" },
        },
      },
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
      grid: { left: 50, right: 30, bottom: 45, top: 50 },
      graphic: [
        {
          type: "text",
          left: "21%",
          bottom: 25,
          style: {
            text: "原来",
            fill: "#666",
            fontSize: 12,
          },
        },
        {
          type: "text",
          left: "79%",
          bottom: 25,
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
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems={{ xs: "flex-start", md: "center" }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography
              color="primary"
              sx={{ fontSize: { xs: "2.5rem", md: "3rem" }, lineHeight: 1 }}
            >
              🦋
            </Typography>
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
      </Container>
      <Container maxWidth="xl" sx={{ pt: 0.2, pb: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper elevation={3} sx={{ borderRadius: 3, p: 3 }}>
              <Typography variant="h6" fontWeight={600} mb={3}>
                📋信息收集进度
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
                    <Typography
                      align="center"
                      fontWeight={700}
                      mb={1}
                      variant="subtitle1"
                      sx={{ fontSize: "1.1rem", color: "text.primary" }}
                    >
                      {column.label}
                    </Typography>
                    <Stack spacing={1} sx={{ flex: 1 }}>
                      {column.items.map((item) => {
                        const raw = item.class_no?.trim() ?? "";
                        let classNumber = raw;
                        if (/^\d+$/.test(raw)) {
                          classNumber = raw;
                        } else if (item.grade) {
                          const gradePrefix = String(item.grade);
                          if (raw.startsWith(gradePrefix)) {
                            const rest = raw.slice(gradePrefix.length);
                            if (/^\d+$/.test(rest) && rest.length > 0) {
                              classNumber = rest;
                            }
                          }
                        }
                        if (!classNumber) {
                          classNumber = "-";
                        }
                        const classLabel =
                          classNumber === "-" ? "—" : `${classNumber}班`;
                        const classKey = buildClassKey(
                          item.grade,
                          item.class_no,
                        );
                        return (
                          <Box
                            key={`${item.grade}-${item.class_no}`}
                            data-class-key={classKey}
                            onClick={(event) =>
                              handleClassClick(
                                event,
                                item.grade,
                                item.class_no ?? "",
                              )
                            }
                            sx={{
                              borderRadius: 1,
                              px: 1.5,
                              py: 1,
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              backgroundColor: "rgba(14, 165, 233, 0.08)",
                              cursor: "pointer",
                              transition: "background-color 0.2s",
                              border:
                                openClassKey === classKey
                                  ? "1px solid rgba(14,165,233,0.4)"
                                  : "1px solid transparent",
                              boxShadow:
                                openClassKey === classKey
                                  ? "0 0 0 2px rgba(14,165,233,0.12)"
                                  : "none",
                            }}
                          >
                            <Typography fontWeight={600} sx={{ textDecoration: "underline" }}>
                              {classLabel}
                            </Typography>
                            <Typography
                              fontWeight={700}
                              sx={{
                                color:
                                  item.total > 0 && item.completed >= item.total
                                    ? "success.main"
                                    : "warning.main",
                              }}
                            >
                              {item.completed}/{item.total}
                            </Typography>
                          </Box>
                        );
                      })}
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
                      <Typography
                        variant="subtitle1"
                        fontWeight={600}
                        mb={0.1}
                        align="center"
                      >
                        🦋{metric}
                      </Typography>
                      <ReactECharts
                        option={renderChartA(metric, data)}
                        style={{ height: CHART_HEIGHT }}
                      />
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
                    <Typography
                      variant="subtitle1"
                      fontWeight={600}
                      mb={0.1}
                      align="center"
                    >
                      劳动参与率走势
                    </Typography>
                    <ReactECharts
                      option={renderLineChart("劳动参与率走势", overallB)}
                      style={{ height: CHART_HEIGHT }}
                    />
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography
                      variant="subtitle1"
                      fontWeight={600}
                      mb={0.1}
                      align="center"
                    >
                      劳动习惯养成率走势
                    </Typography>
                    <ReactECharts
                      option={renderLineChart("劳动习惯养成率走势", overallC)}
                      style={{ height: CHART_HEIGHT }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Container>
      <Popper
        open={Boolean(dropdownAnchor && openClassKey)}
        anchorEl={dropdownAnchor}
        placement="bottom-start"
        transition
        modifiers={[{ name: "offset", options: { offset: [0, 8] } }]}
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={150}>
            <Paper
              ref={popperRef}
              elevation={6}
              sx={{
                borderRadius: 2,
                minWidth: 220,
                maxHeight: 320,
                overflowY: "auto",
                p: 1,
                zIndex: 1400,
              }}
            >
              {studentsForDropdown.length > 0 ? (
                <List dense>
                  {studentsForDropdown.map((student) => {
                    const number = (student.student_no ?? "").trim();
                    const displayName = number
                      ? `${number} ${student.student_name}`
                      : student.student_name;
                    return (
                      <ListItemButton
                        key={student.student_id}
                        onClick={() => handleStudentNavigate(student.student_id)}
                      >
                        <ListItemText primary={displayName} />
                      </ListItemButton>
                    );
                  })}
                </List>
              ) : (
                <Box px={1.5} py={1}>
                  <Typography color="text.secondary">
                    暂未查询到学生信息
                  </Typography>
                </Box>
              )}
            </Paper>
          </Fade>
        )}
      </Popper>
    </Box>
  );
};

export default AdminDashboard;
