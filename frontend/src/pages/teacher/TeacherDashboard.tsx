import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  FormControlLabel,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Switch,
  Toolbar,
  Typography,
  Checkbox,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import EmojiNatureIcon from "@mui/icons-material/EmojiNature";
import LogoutIcon from "@mui/icons-material/Logout";
import { useCallback, useEffect, useMemo, useState } from "react";

import client from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { toastError, toastInfo, toastSuccess } from "../../components/toast";

type StudentItem = {
  student_id: string;
  student_name: string;
  class_no: string;
  grade: number;
  grade_band: string;
  completion_status: boolean;
};

type SurveySection = {
  major_category: string;
  minor_category: string;
  items: { id: number; prompt: string }[];
};

type SurveyConfig = {
  traits: string[];
  sections: SurveySection[];
};

type SurveyAnswer = {
  frequency: string;
  skill: string;
  traits: string[];
};

type StudentDetail = {
  student: {
    id: string;
    student_name: string;
    class_no: string;
    grade: number;
    grade_band: string;
  };
  survey: {
    items: {
      survey_item_id: number;
      frequency: string;
      skill: string;
      traits: string[];
    }[];
  } | null;
  parent_note: {
    content: string;
    updated_at: string;
  } | null;
  composite: {
    q1: Record<string, string>;
    q2: Record<string, string>;
    q3: Record<string, Record<string, number>>;
  } | null;
  teacher_review: {
    selected_traits: string[];
    rendered_text: string;
  } | null;
  lock: {
    is_locked: boolean;
  };
};

const frequencyOptions = ["每天", "经常", "偶尔"];
const skillOptions = ["熟练", "一般", "不会"];

const TeacherDashboard = () => {
  const auth = useAuthStore();
  const clearAuth = useAuthStore((state) => state.clear);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StudentDetail | null>(null);
  const [config, setConfig] = useState<SurveyConfig | null>(null);
  const [answers, setAnswers] = useState<Record<number, SurveyAnswer>>({});
  const [originalAnswers, setOriginalAnswers] = useState<
    Record<number, SurveyAnswer>
  >({});
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [lockStatus, setLockStatus] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingSurvey, setSavingSurvey] = useState(false);
  const [savingLock, setSavingLock] = useState(false);
  const [savingReview, setSavingReview] = useState(false);

  const dirtySurvey = useMemo(() => {
    const keys = new Set([
      ...Object.keys(originalAnswers),
      ...Object.keys(answers),
    ]);
    for (const key of keys) {
      const original = originalAnswers[Number(key)];
      const current = answers[Number(key)];
      if (!original && current) {
        return true;
      }
      if (original && !current) {
        return true;
      }
      if (
        original &&
        current &&
        (original.frequency !== current.frequency ||
          original.skill !== current.skill ||
          original.traits.sort().join(",") !==
            (current.traits ?? []).sort().join(","))
      ) {
        return true;
      }
    }
    return false;
  }, [answers, originalAnswers]);

  const dirtyReview = useMemo(() => {
    const original = detail?.teacher_review?.selected_traits ?? [];
    return selectedTraits.sort().join(",") !== original.sort().join(",");
  }, [detail?.teacher_review?.selected_traits, selectedTraits]);

  const fetchStudents = useCallback(async () => {
    const { data } = await client.get("/teacher/class/students");
    setStudents(data);
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const loadDetail = useCallback(async (studentId: string) => {
    setLoadingDetail(true);
    try {
      const { data } = await client.get(`/teacher/students/${studentId}`);
      setDetail(data);
      setLockStatus(data.lock?.is_locked ?? false);
      const gradeBand = data.student.grade_band ?? "low";
      const conf = await client.get(`/config/survey?grade_band=${gradeBand}`);
      setConfig(conf.data);
      const mapped: Record<number, SurveyAnswer> = {};
      data.survey?.items?.forEach((item: any) => {
        mapped[item.survey_item_id] = {
          frequency: item.frequency ?? "",
          skill: item.skill ?? "",
          traits: item.traits ?? [],
        };
      });
      setAnswers(mapped);
      setOriginalAnswers(mapped);
      setSelectedTraits(data.teacher_review?.selected_traits ?? []);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (!auth.user?.school_name || !auth.user?.class_no) {
      return undefined;
    }
    const classKey = `${auth.user.school_name}-${auth.user.class_no}`;
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(
      `${protocol}://${window.location.host}/ws/teacher/${encodeURIComponent(classKey)}`,
    );
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        fetchStudents();
        if (payload.student_id && payload.student_id === selectedId) {
          loadDetail(payload.student_id);
        }
      } catch (error) {
        // ignore parsing failure
      }
    };
    return () => socket.close();
  }, [
    auth.user?.school_name,
    auth.user?.class_no,
    selectedId,
    fetchStudents,
    loadDetail,
  ]);

  const handleLogout = async () => {
    try {
      await client.post("/auth/logout");
    } catch (error) {
      // ignore
    }
    clearAuth();
    window.location.href = "/login";
  };

  const handleSelectStudent = (studentId: string) => {
    if (dirtySurvey || dirtyReview) {
      const ok = window.confirm("是否保存更改？未保存的内容将丢失!");
      if (!ok) {
        return;
      }
    }
    setSelectedId(studentId);
    loadDetail(studentId);
  };

  const updateAnswer = (itemId: number, partial: Partial<SurveyAnswer>) => {
    setAnswers((prev) => {
      const existing = prev[itemId] ?? { frequency: "", skill: "", traits: [] };
      return {
        ...prev,
        [itemId]: {
          ...existing,
          ...partial,
        },
      };
    });
  };

  const toggleTrait = (itemId: number, trait: string) => {
    setAnswers((prev) => {
      const existing = prev[itemId] ?? { frequency: "", skill: "", traits: [] };
      let traits = existing.traits ?? [];
      if (traits.includes(trait)) {
        traits = traits.filter((t) => t !== trait);
      } else {
        if (traits.length >= 3) {
          toastError("品格养成最多选择3项！");
          return prev;
        }
        traits = [...traits, trait];
      }
      return {
        ...prev,
        [itemId]: { ...existing, traits },
      };
    });
  };

  const toggleReviewTrait = (trait: string) => {
    setSelectedTraits((prev) =>
      prev.includes(trait)
        ? prev.filter((item) => item !== trait)
        : [...prev, trait],
    );
  };

  const saveSurvey = async () => {
    if (!selectedId) return;
    setSavingSurvey(true);
    try {
      const items = Object.entries(answers)
        .filter(
          ([_id, value]) =>
            value.frequency ||
            value.skill ||
            (value.traits && value.traits.length > 0),
        )
        .map(([id, value]) => ({
          survey_item_id: Number(id),
          frequency: value.frequency || null,
          skill: value.skill || null,
          traits: value.traits,
        }));
      const { data } = await client.put(
        `/teacher/students/${selectedId}/survey`,
        { items },
      );
      toastSuccess("保存成功");
      const updated: Record<number, SurveyAnswer> = {};
      data.items.forEach((item: any) => {
        updated[item.survey_item_id] = {
          frequency: item.frequency ?? "",
          skill: item.skill ?? "",
          traits: item.traits ?? [],
        };
      });
      setAnswers(updated);
      setOriginalAnswers(updated);
    } finally {
      setSavingSurvey(false);
    }
  };

  const toggleLock = async (nextStatus: boolean) => {
    if (!selectedId) return;
    setSavingLock(true);
    try {
      await client.put(`/teacher/students/${selectedId}/lock`, {
        is_locked: nextStatus,
      });
      setLockStatus(nextStatus);
      toastInfo(nextStatus ? "已锁定当前信息" : "已解锁，学生可继续编辑");
    } finally {
      setSavingLock(false);
    }
  };

  const saveReview = async () => {
    if (!selectedId) return;
    if (selectedTraits.length === 0) {
      toastError("请至少选择一个关键词！");
      return;
    }
    setSavingReview(true);
    try {
      const { data } = await client.post(
        `/teacher/students/${selectedId}/review`,
        {
          selected_traits: selectedTraits,
        },
      );
      toastSuccess("教师评价已保存");
      setSelectedTraits(data.selected_traits ?? selectedTraits);
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              teacher_review: data,
            }
          : prev,
      );
    } finally {
      setSavingReview(false);
    }
  };

  const handleReturnList = () => {
    if (dirtySurvey || dirtyReview) {
      const ok = window.confirm("是否保存更改？未保存的内容将丢失！");
      if (!ok) {
        return;
      }
    }
    setSelectedId(null);
    setDetail(null);
  };

  return (
    <Box sx={{ backgroundColor: "#fef5ef", minHeight: "100vh" }}>
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <EmojiNatureIcon color="primary" />
            <Typography variant="h6" color="primary" fontWeight={700}>
              班主任工作台
            </Typography>
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography color="text.secondary">
              {auth.user?.teacher_name} ??
            </Typography>
            <Button
              startIcon={<LogoutIcon />}
              variant="outlined"
              onClick={handleLogout}
            >
              退出系统{" "}
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Paper elevation={3} sx={{ borderRadius: 3 }}>
              <Box px={3} py={2}>
                <Typography variant="h6" fontWeight={600}>
                  班级学生
                </Typography>
              </Box>
              <Divider />
              <List>
                {students.map((student) => (
                  <ListItemButton
                    key={student.student_id}
                    selected={student.student_id === selectedId}
                    onClick={() => handleSelectStudent(student.student_id)}
                  >
                    <ListItemText
                      primary={`${student.student_name}`}
                      secondary={
                        student.completion_status
                          ? "已完成信息收集✔"
                          : "待完善..."
                      }
                    />
                  </ListItemButton>
                ))}
              </List>
            </Paper>
          </Grid>
          <Grid item xs={12} md={9}>
            {selectedId ? (
              loadingDetail ? (
                <Stack
                  alignItems="center"
                  justifyContent="center"
                  minHeight="40vh"
                >
                  <CircularProgress />
                  <Typography mt={2}>学生信息加载中...</Typography>
                </Stack>
              ) : (
                detail &&
                config && (
                  <Stack spacing={3}>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", md: "center" }}
                      spacing={2}
                    >
                      <Box>
                        <Typography variant="h5" fontWeight={700}>
                          {detail.student.student_name}
                        </Typography>
                        <Typography color="text.secondary">
                          {detail.student.grade}年级{detail.student.class_no}
                          班{" "}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={2}>
                        <Button variant="outlined" onClick={handleReturnList}>
                          返回查看班级列表
                        </Button>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={lockStatus}
                              onChange={(event) =>
                                toggleLock(event.target.checked)
                              }
                              disabled={savingLock}
                            />
                          }
                          label={lockStatus ? "解锁" : "锁定当前信息"}
                        />
                      </Stack>
                    </Stack>

                    <Card>
                      <CardContent>
                        <Typography variant="h6" fontWeight={600} mb={2}>
                          学生自评表{" "}
                        </Typography>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell width="22%">劳动项目</TableCell>
                              <TableCell width="20%">参与情况</TableCell>
                              <TableCell width="20%">技能掌握</TableCell>
                              <TableCell>品格养成</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {config.sections.map((section) =>
                              section.items.map((item) => {
                                const value = answers[item.id] ?? {
                                  frequency: "",
                                  skill: "",
                                  traits: [],
                                };
                                return (
                                  <TableRow key={item.id}>
                                    <TableCell>
                                      <Typography fontWeight={600}>
                                        {section.major_category}
                                      </Typography>
                                      <Typography color="text.secondary">
                                        {section.minor_category}
                                      </Typography>
                                      <Typography mt={1}>
                                        {item.prompt}
                                      </Typography>
                                    </TableCell>
                                    <TableCell>
                                      <RadioGroup
                                        value={value.frequency}
                                        onChange={(event) =>
                                          updateAnswer(item.id, {
                                            frequency: event.target.value,
                                          })
                                        }
                                        row
                                      >
                                        {frequencyOptions.map((option) => (
                                          <FormControlLabel
                                            key={option}
                                            value={option}
                                            control={<Radio />}
                                            label={option}
                                          />
                                        ))}
                                      </RadioGroup>
                                    </TableCell>
                                    <TableCell>
                                      <RadioGroup
                                        value={value.skill}
                                        onChange={(event) =>
                                          updateAnswer(item.id, {
                                            skill: event.target.value,
                                          })
                                        }
                                        row
                                      >
                                        {skillOptions.map((option) => (
                                          <FormControlLabel
                                            key={option}
                                            value={option}
                                            control={<Radio />}
                                            label={option}
                                          />
                                        ))}
                                      </RadioGroup>
                                    </TableCell>
                                    <TableCell>
                                      <Grid container spacing={1}>
                                        {config.traits.map((trait) => (
                                          <Grid item xs={4} key={trait}>
                                            <FormControlLabel
                                              control={
                                                <Checkbox
                                                  checked={value.traits.includes(
                                                    trait,
                                                  )}
                                                  onChange={() =>
                                                    toggleTrait(item.id, trait)
                                                  }
                                                />
                                              }
                                              label={trait}
                                            />
                                          </Grid>
                                        ))}
                                      </Grid>
                                    </TableCell>
                                  </TableRow>
                                );
                              }),
                            )}
                          </TableBody>
                        </Table>
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={2}
                          mt={3}
                        >
                          <Button
                            variant="contained"
                            onClick={saveSurvey}
                            disabled={!dirtySurvey || savingSurvey}
                          >
                            {savingSurvey ? "保存中..." : "确认保存修改"}
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent>
                        <Typography variant="h6" fontWeight={600} mb={2}>
                          家长寄语
                        </Typography>
                        <Typography
                          sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}
                          color="text.secondary"
                        >
                          {detail.parent_note?.content ?? "暂无家长寄语­"}
                        </Typography>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent>
                        <Typography variant="h6" fontWeight={600} mb={2}>
                          教师评价模板
                        </Typography>
                        <Typography color="text.secondary" mb={2}>
                          亲爱的蝶宝：在劳动中，老师看到了你的_______，希望你再接再厉，成长为坚毅担责、勤劳诚实、合作智慧的“小彩蝶”！
                        </Typography>
                        <Stack spacing={1}>
                          {config.traits.map((trait) => (
                            <FormControlLabel
                              key={trait}
                              control={
                                <Checkbox
                                  checked={selectedTraits.includes(trait)}
                                  onChange={() => toggleReviewTrait(trait)}
                                />
                              }
                              label={trait}
                            />
                          ))}
                        </Stack>
                        <Stack
                          direction={{ xs: "column", md: "row" }}
                          spacing={2}
                          mt={3}
                        >
                          <Button
                            variant="contained"
                            onClick={saveReview}
                            disabled={!dirtyReview || savingReview}
                          >
                            {savingReview ? "保存中.." : "保存"}
                          </Button>
                          <Button variant="outlined" onClick={handleReturnList}>
                            返回查看班级列表
                          </Button>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Stack>
                )
              )
            ) : (
              <Stack
                alignItems="center"
                justifyContent="center"
                minHeight="50vh"
              >
                <Typography color="text.secondary">
                  请选择一位学生查看详情{" "}
                </Typography>
              </Stack>
            )}
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default TeacherDashboard;
