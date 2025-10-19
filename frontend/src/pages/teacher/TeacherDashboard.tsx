import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import {
  Box,
  Button,
  CircularProgress,
  Grid,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Checkbox,
  FormControlLabel,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import client from "../../api/client";
import { toastError, toastInfo, toastSuccess } from "../../components/toast";
import { useAuthStore } from "../../store/auth";

type TeacherStudentRow = {
  student_id: string;
  student_no: string | null;
  student_name: string;
  class_no: string;
  grade: number;
  grade_band: string;
  survey_completed: boolean;
  parent_submitted: boolean;
  teacher_submitted: boolean;
  info_completed: boolean;
  selected_traits: string[];
};

type GradeBandKey = "low" | "mid" | "high";

const TRAITS_BY_BAND: Record<GradeBandKey, string[]> = {
  low: ["坚持", "主动", "勤快", "真诚", "互助", "乐学"],
  mid: ["坚强", "负责", "勤俭", "诚恳", "协作", "探究"],
  high: ["坚韧", "担当", "勤奋", "诚信", "团结", "创新"],
};

const normalizeTraits = (traits: string[], options: string[]) =>
  [...traits].sort((a, b) => options.indexOf(a) - options.indexOf(b));

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const auth = useAuthStore();

  const [students, setStudents] = useState<TeacherStudentRow[]>([]);
  const studentsRef = useRef<TeacherStudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [dirtyMap, setDirtyMap] = useState<Record<string, boolean>>({});
  const dirtyRef = useRef<Record<string, boolean>>({});
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({});
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    studentsRef.current = students;
  }, [students]);

  useEffect(() => {
    dirtyRef.current = dirtyMap;
  }, [dirtyMap]);

  const hasDirty = useMemo(
    () => Object.values(dirtyMap).some(Boolean),
    [dirtyMap],
  );

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!hasDirty) return;
      event.preventDefault();
      // eslint-disable-next-line no-param-reassign
      event.returnValue = "";
    };
    if (hasDirty) {
      window.addEventListener("beforeunload", handler);
    }
    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, [hasDirty]);

  useEffect(() => {
    (window as any).__teacherDirtyGuard = hasDirty;
    return () => {
      (window as any).__teacherDirtyGuard = false;
    };
  }, [hasDirty]);

  const getTraitOptions = useCallback(
    (band: string): string[] => {
      if (band === "mid" || band === "high") {
        return TRAITS_BY_BAND[band];
      }
      return TRAITS_BY_BAND.low;
    },
    [],
  );

  const loadStudents = useCallback(
    async (options: { silent?: boolean } = {}) => {
      const { silent = false } = options;
      if (!silent) {
        setLoading(true);
      }
      try {
        const { data } = await client.get("/teacher/class/students");
        setStudents(data);
        setSelections((prev) => {
          const next: Record<string, string[]> = {};
          const currentDirty = dirtyRef.current;
          data.forEach((row: TeacherStudentRow) => {
            const optionsList = getTraitOptions(row.grade_band);
            if (currentDirty[row.student_id]) {
              const existing = prev[row.student_id] ?? row.selected_traits;
              next[row.student_id] = normalizeTraits(existing, optionsList);
            } else {
              next[row.student_id] = normalizeTraits(
                row.selected_traits,
                optionsList,
              );
            }
          });
          return next;
        });
        setDirtyMap((prev) => {
          const next: Record<string, boolean> = {};
          data.forEach((row: TeacherStudentRow) => {
            next[row.student_id] = prev[row.student_id] ?? false;
          });
          return next;
        });
        setSavingMap((prev) => {
          const next: Record<string, boolean> = {};
          data.forEach((row: TeacherStudentRow) => {
            if (prev[row.student_id]) {
              next[row.student_id] = prev[row.student_id];
            }
          });
          return next;
        });
      } catch (error: any) {
        const message =
          error?.response?.data?.detail ?? "加载班级数据失败，请稍后重试。";
        toastError(message);
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [getTraitOptions],
  );

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    if (auth.user?.role === "admin") {
      return undefined;
    }
    const school = auth.user?.school_name;
    const classNo = auth.user?.class_no;
    if (!school || !classNo) {
      return undefined;
    }
    const classKey = `${school}-${classNo}`;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(
      `${protocol}://${window.location.host}/ws/teacher/${encodeURIComponent(classKey)}`,
    );
    socketRef.current = ws;
    ws.onmessage = () => {
      loadStudents({ silent: true });
    };
    ws.onclose = () => {
      socketRef.current = null;
    };
    return () => {
      ws.close();
      socketRef.current = null;
    };
  }, [
    auth.user?.role,
    auth.user?.school_name,
    auth.user?.class_no,
    loadStudents,
  ]);

  const arraysEqual = useCallback(
    (a: string[], b: string[], options: string[]) => {
      if (a.length !== b.length) return false;
      const sortedA = normalizeTraits(a, options);
      const sortedB = normalizeTraits(b, options);
      return sortedA.every((value, index) => value === sortedB[index]);
    },
    [],
  );

  const handleToggleTrait = useCallback(
    (studentId: string, trait: string) => {
      const student = studentsRef.current.find(
        (item) => item.student_id === studentId,
      );
      if (!student) {
        return;
      }
      const options = getTraitOptions(student.grade_band);
      setSelections((prev) => {
        const current = prev[studentId] ?? student.selected_traits ?? [];
        const hasTrait = current.includes(trait);
        const base = hasTrait
          ? current.filter((item) => item !== trait)
          : [...current, trait];
        const next = normalizeTraits(base, options);
        setDirtyMap((dirtyPrev) => ({
          ...dirtyPrev,
          [studentId]: !arraysEqual(next, student.selected_traits ?? [], options),
        }));
        return {
          ...prev,
          [studentId]: next,
        };
      });
    },
    [arraysEqual, getTraitOptions],
  );

  const handleSave = useCallback(
    async (studentId: string) => {
      const student = studentsRef.current.find(
        (item) => item.student_id === studentId,
      );
      if (!student) {
        return;
      }
      const selection = selections[studentId] ?? [];
      if (selection.length === 0) {
        toastInfo("请至少选择一个关键词后再保存~");
        return;
      }
      setSavingMap((prev) => ({ ...prev, [studentId]: true }));
      try {
        const { data } = await client.post(
          `/teacher/students/${studentId}/review`,
          { selected_traits: selection },
        );
        toastSuccess("教师评价已保存");
        setStudents((prev) =>
          prev.map((row) =>
            row.student_id === studentId
              ? {
                  ...row,
                  selected_traits: data.selected_traits ?? selection,
                  teacher_submitted: true,
                  info_completed:
                    row.survey_completed &&
                    row.parent_submitted &&
                    (data.selected_traits ?? selection).length > 0,
                }
              : row,
          ),
        );
        setSelections((prev) => ({
          ...prev,
          [studentId]: selection,
        }));
        setDirtyMap((prev) => ({ ...prev, [studentId]: false }));
      } catch (error: any) {
        const message =
          error?.response?.data?.detail ?? "保存评价失败，请稍后重试。";
        toastError(message);
      } finally {
        setSavingMap((prev) => ({ ...prev, [studentId]: false }));
      }
    },
    [selections],
  );

  const handleNavigateToStudent = useCallback(
    (studentId: string) => {
      if (hasDirty) {
        const confirmed = window.confirm(
          "检测到仍有未保存的评价，是否放弃并继续？",
        );
        if (!confirmed) {
          return;
        }
      }
      navigate(`/teacher/students/${studentId}`);
    },
    [hasDirty, navigate],
  );

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" minHeight="40vh">
        <CircularProgress color="primary" />
        <Typography mt={2}>班级学生信息加载中，请稍候...</Typography>
      </Stack>
    );
  }

  if (students.length === 0) {
    return (
      <Paper elevation={2} sx={{ p: 6, textAlign: "center" }}>
        <Typography variant="h6" mb={1}>
          暂未找到班级学生
        </Typography>
        <Typography color="text.secondary">
          请确认班级信息是否正确，或稍后再试。
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={3} alignItems="center">
      <Typography variant="h5" fontWeight={700} alignSelf="center">
        班级学生列表
      </Typography>
      <TableContainer
        component={Paper}
        elevation={3}
        sx={{ borderRadius: 3, maxWidth: 980, mx: "auto" }}
      >
        <Table sx={{ minWidth: 880 }} size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, width: 100, textAlign: "center" }}>
                学号
              </TableCell>
              <TableCell sx={{ fontWeight: 700, width: 160, textAlign: "center" }}>
                姓名
              </TableCell>
              <TableCell sx={{ fontWeight: 700, width: 220, textAlign: "center" }}>
                信息收集情况
              </TableCell>
              <TableCell
                sx={{ fontWeight: 700, textAlign: "center", width: 320 }}
              >
                教师评价
              </TableCell>
              <TableCell sx={{ width: 150, textAlign: "center", pl: 2.5 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {students.map((row) => {
              const options = getTraitOptions(row.grade_band);
              const currentSelection = selections[row.student_id] ?? [];
              const dirty = dirtyMap[row.student_id] ?? false;
              const saving = savingMap[row.student_id] ?? false;
              const statusText = row.info_completed
                ? "已完成信息采集"
                : "信息待完善…";
              const saveDisabled =
                saving || currentSelection.length === 0 || !dirty;

              const firstRow = options.slice(0, 3);
              const secondRow = options.slice(3, 6);

              return (
                <TableRow
                  key={row.student_id}
                  sx={{
                    "&:nth-of-type(odd)": { backgroundColor: "rgba(255,248,240,0.6)" },
                  }}
                >
                  <TableCell sx={{ fontSize: "0.95rem", textAlign: "center" }}>
                    {row.student_no || "--"}
                  </TableCell>
                  <TableCell sx={{ textAlign: "center", pl: 3 }}>
                    <Button
                      variant="text"
                      color="inherit"
                      onClick={() => handleNavigateToStudent(row.student_id)}
                      sx={{
                        textDecoration: "underline",
                        fontWeight: 400,
                        color: "text.primary",
                        "&:hover": { textDecoration: "underline" },
                      }}
                    >
                      {row.student_name}
                    </Button>
                  </TableCell>
                  <TableCell sx={{ textAlign: "center", pl: 3 }}>
                    <Stack
                      direction="row"
                      spacing={0.5}
                      alignItems="center"
                      justifyContent="center"
                    >
                      {row.info_completed ? (
                        <CheckCircleOutlineIcon color="success" fontSize="small" />
                      ) : (
                        <PendingActionsIcon color="warning" fontSize="small" />
                      )}
                      <Typography
                        color={row.info_completed ? "success.main" : "warning.main"}
                        fontWeight={600}
                      >
                        {statusText}
                      </Typography>
                    </Stack>
                    {!row.survey_completed && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        自评问卷需完整填写
                      </Typography>
                    )}
                    {!row.parent_submitted && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        家长寄语尚未提交
                      </Typography>
                    )}
                    {!row.teacher_submitted && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        请完成教师评价后保存
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell sx={{ textAlign: "center", pr: 3, width: 320 }}>
                    <Stack spacing={1.5} alignItems="center" justifyContent="center">
                      <Grid container spacing={0.5} justifyContent="center">
                        {firstRow.map((trait) => (
                          <Grid item xs="auto" key={trait}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={currentSelection.includes(trait)}
                                  onChange={() =>
                                    handleToggleTrait(row.student_id, trait)
                                  }
                                />
                              }
                              label={trait}
                            />
                          </Grid>
                        ))}
                      </Grid>
                      <Grid container spacing={0.5} justifyContent="center">
                        {secondRow.map((trait) => (
                          <Grid item xs="auto" key={trait}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={currentSelection.includes(trait)}
                                  onChange={() =>
                                    handleToggleTrait(row.student_id, trait)
                                  }
                                />
                              }
                              label={trait}
                            />
                          </Grid>
                        ))}
                      </Grid>
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ textAlign: "center", pl: 0.5, pr: 7, width: 150 }}>

                    <Stack spacing={0.5} alignItems="center">
                      <Button
                        variant="contained"
                        sx={{
                          minWidth: 110,
                          borderRadius: 12,
                          px: 1.75,
                          mx: "auto",
                        }}
                        onClick={() => handleSave(row.student_id)}
                        disabled={saveDisabled}
                      >
                        {saving ? "保存中..." : "保存评价"}
                      </Button>
                      {dirty && (
                        <Typography
                          variant="caption"
                          color="primary"
                          textAlign="center"
                        >
                          请保存~
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
  );
};

export default TeacherDashboard;
