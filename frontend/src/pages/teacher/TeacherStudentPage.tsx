import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  Radio,
  RadioGroup,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  ChangeEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";

import client from "../../api/client";
import { toastError, toastInfo, toastSuccess } from "../../components/toast";
import { useAuthStore } from "../../store/auth";

type SurveyItemAnswer = {
  frequency: string;
  skill: string;
  traits: string[];
};

type SurveySection = {
  major_category: string;
  minor_category: string;
  items: { id: number; prompt: string }[];
};

type CompositeQuestion = {
  key: string;
  question: string;
  rows: string[];
  columns: string[];
  scale?: number[];
  rows_by_grade?: Record<string, string[]>;
};

type SurveyConfig = {
  description: string;
  grade_band: string;
  traits: string[];
  sections: SurveySection[];
  composite_questions: CompositeQuestion[];
};

type TeacherStudentDetail = {
  student: {
    id: string;
    student_name: string;
    student_no: string;
    class_no: string;
    grade: number;
    grade_band: string | null;
  };
  survey: {
    items: {
      survey_item_id: number;
      frequency: string | null;
      skill: string | null;
      traits: string[];
    }[];
  } | null;
  composite:
    | {
        q1: Record<string, string>;
        q2: Record<string, string>;
        q3: Record<string, Record<string, number>>;
        submitted_at?: string;
        updated_at?: string;
      }
    | null;
  parent_note:
    | {
        content: string;
        updated_at: string;
        submitted_at: string;
      }
    | null;
  lock: {
    is_locked: boolean;
    updated_at?: string;
  } | null;
};

const surveyFrequencyOptions = ["每天", "经常", "偶尔"];
const frequencyOptions = ["每天", "经常", "偶尔", "从不"];
const skillOptions = ["熟练", "一般", "不会"];
const habitOptions = ["完全同意", "比较同意", "部分同意", "不同意"];
const DEFAULT_METRIC_LABELS = ["坚毅担责", "勤劳诚实", "合作智慧"];
const compositeStageHints: Record<string, Record<string, string>> = {
  "2": {
    阶段1: "（2024.8-2025.8）",
    阶段2: "（2025.8-现在）",
  },
  default: {
    阶段1: "（2023.8-2024.8）",
    阶段2: "（2024.8-2025.8）",
    阶段3: "（2025.8-现在）",
  },
};

type StructuredRow = {
  major: string;
  minor: string;
  item: { id: number; prompt: string };
  showMajor: boolean;
  showMinor: boolean;
  majorRowSpan: number;
  minorRowSpan: number;
};

type SurveyRowProps = {
  row: StructuredRow;
  value: SurveyItemAnswer | undefined;
  traitsList: string[];
  onUpdateAnswer: (itemId: number, partial: Partial<SurveyItemAnswer>) => void;
  onToggleTrait: (itemId: number, trait: string) => void;
};

const columnBorderSx = { borderRight: 1, borderColor: "divider" };
const tableMainHeaderSx = {
  fontSize: "1.1rem",
  fontWeight: 700,
  textAlign: "center",
  whiteSpace: "nowrap",
  lineHeight: 1.4,
};
const tableSubHeaderSx = {
  fontSize: "1.05rem",
  fontWeight: 600,
  textAlign: "center",
  whiteSpace: "nowrap",
  lineHeight: 1.4,
};
const optionLabelSx = {
  mr: 0,
  whiteSpace: "nowrap",
  "& .MuiFormControlLabel-label": { fontSize: "0.95rem" },
};
const verticalCategoryTextSx = {
  writingMode: "vertical-rl",
  textOrientation: "upright",
  fontSize: "1.05rem",
  fontWeight: 600,
  display: "inline-block",
  margin: "0 auto",
};
const verticalSubCategoryTextSx = {
  writingMode: "vertical-rl",
  textOrientation: "upright",
  fontSize: "1rem",
  fontWeight: 600,
  display: "inline-block",
  margin: "0 auto",
};
const projectTextSx = {
  fontSize: "0.95rem",
  textAlign: "left",
  whiteSpace: "normal",
  lineHeight: 1.6,
  display: "inline-block",
};

const EMPTY_ANSWER: SurveyItemAnswer = {
  frequency: "",
  skill: "",
  traits: [],
};

const SurveyRow = memo(
  ({ row, value, traitsList, onUpdateAnswer, onToggleTrait }: SurveyRowProps) => {
    const currentValue = value ?? EMPTY_ANSWER;

    return (
      <TableRow sx={{ "& td": { py: 1.5 } }}>
        {row.showMajor && (
          <TableCell
            rowSpan={row.majorRowSpan}
            sx={{
              ...columnBorderSx,
              verticalAlign: "middle",
              textAlign: "center",
              minWidth: 80,
              px: 1,
            }}
          >
            <Typography sx={verticalCategoryTextSx}>{row.major}</Typography>
          </TableCell>
        )}
        {row.showMinor && (
          <TableCell
            rowSpan={row.minorRowSpan}
            sx={{
              ...columnBorderSx,
              verticalAlign: "middle",
              textAlign: "center",
              minWidth: 90,
              px: 1,
            }}
          >
            <Typography sx={verticalSubCategoryTextSx}>{row.minor}</Typography>
          </TableCell>
        )}
        <TableCell
          sx={{
            ...columnBorderSx,
            verticalAlign: "middle",
            textAlign: "center",
            minWidth: 160,
            px: 2,
          }}
        >
          <Typography sx={projectTextSx}>{row.item.prompt}</Typography>
        </TableCell>
        <TableCell
          sx={{
            ...columnBorderSx,
            verticalAlign: "middle",
            textAlign: "center",
            px: 2,
          }}
        >
          <RadioGroup
            row
            value={currentValue.frequency}
            onChange={(event) =>
              onUpdateAnswer(row.item.id, { frequency: event.target.value })
            }
            sx={{
              flexWrap: "nowrap",
              columnGap: 2,
              justifyContent: "center",
            }}
          >
            {surveyFrequencyOptions.map((option) => (
              <FormControlLabel
                key={option}
                value={option}
                control={<Radio size="small" sx={{ p: 0.5 }} />}
                label={option}
                sx={optionLabelSx}
              />
            ))}
          </RadioGroup>
        </TableCell>
        <TableCell
          sx={{
            ...columnBorderSx,
            verticalAlign: "middle",
            textAlign: "center",
            px: 2,
          }}
        >
          <RadioGroup
            row
            value={currentValue.skill}
            onChange={(event) =>
              onUpdateAnswer(row.item.id, { skill: event.target.value })
            }
            sx={{
              flexWrap: "nowrap",
              columnGap: 2,
              justifyContent: "center",
            }}
          >
            {skillOptions.map((option) => (
              <FormControlLabel
                key={option}
                value={option}
                control={<Radio size="small" sx={{ p: 0.5 }} />}
                label={option}
                sx={optionLabelSx}
              />
            ))}
          </RadioGroup>
        </TableCell>
        <TableCell
          sx={{
            ...columnBorderSx,
            verticalAlign: "middle",
            textAlign: "center",
            minWidth: 240,
            px: 2,
          }}
        >
          <Grid container rowSpacing={0.5} columnSpacing={1}>
            {traitsList.map((trait) => (
              <Grid item xs={4} key={trait}>
                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      sx={{ p: 0.5 }}
                      checked={currentValue.traits.includes(trait)}
                      onChange={() => onToggleTrait(row.item.id, trait)}
                    />
                  }
                  label={trait}
                  sx={{
                    mr: 0,
                    whiteSpace: "nowrap",
                    "& .MuiFormControlLabel-label": {
                      fontSize: "0.95rem",
                    },
                  }}
                />
              </Grid>
            ))}
          </Grid>
        </TableCell>
      </TableRow>
    );
  },
  (prev, next) => {
    if (prev.row !== next.row) return false;
    if (prev.traitsList !== next.traitsList) return false;
    if (prev.value === next.value) return true;
    if (!prev.value || !next.value) return false;
    if (
      prev.value.frequency !== next.value.frequency ||
      prev.value.skill !== next.value.skill
    ) {
      return false;
    }
    if (prev.value.traits.length !== next.value.traits.length) {
      return false;
    }
    return prev.value.traits.every(
      (trait, index) => trait === next.value!.traits[index],
    );
  },
);

SurveyRow.displayName = "SurveyRow";

type TeacherSurveyContentProps = {
  config: SurveyConfig;
  answers: Record<number, SurveyItemAnswer>;
  composite: {
    q1: Record<string, string>;
    q2: Record<string, string>;
    q3: Record<string, Record<string, number>>;
  };
  traitsList: string[];
  stages: string[];
  studentGrade: number | null;
  isFirstGrade: boolean;
  metrics: string[];
  onUpdateAnswer: (itemId: number, partial: Partial<SurveyItemAnswer>) => void;
  onToggleTrait: (itemId: number, trait: string) => void;
  onCompositeRadio: (
    questionKey: "q1" | "q2",
    rowKey: string,
    value: string,
  ) => void;
  onCompositeScore: (stage: string, metric: string, raw: string) => void;
};

const TeacherSurveyContent = memo(
  ({
    config,
    answers,
    composite,
    traitsList,
    stages,
    studentGrade,
    isFirstGrade,
    metrics,
    onUpdateAnswer,
    onToggleTrait,
    onCompositeRadio,
    onCompositeScore,
  }: TeacherSurveyContentProps) => {
    const structuredRows = useMemo(() => {
      const totals = new Map<string, number>();
      config.sections.forEach((section) => {
        totals.set(
          section.major_category,
          (totals.get(section.major_category) ?? 0) + section.items.length,
        );
      });

      const rows: StructuredRow[] = [];
      const majorSeen = new Map<string, number>();
      config.sections.forEach((section) => {
        const majorKey = section.major_category;
        section.items.forEach((item, index) => {
          const processed = majorSeen.get(majorKey) ?? 0;
          const showMajor = processed === 0;
          majorSeen.set(majorKey, processed + 1);
          rows.push({
            major: majorKey,
            minor: section.minor_category,
            item,
            showMajor,
            showMinor: index === 0,
            majorRowSpan: showMajor
              ? (totals.get(majorKey) ?? section.items.length)
              : 0,
            minorRowSpan: index === 0 ? section.items.length : 0,
          });
        });
      });
      return rows;
    }, [config.sections]);

    return (
      <>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={600} mb={2}>
              📑学生自评表
            </Typography>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 960 }}>
                <TableHead>
                  <TableRow>
                    <TableCell colSpan={3} sx={{ ...columnBorderSx, ...tableMainHeaderSx }}>
                      劳动项目
                    </TableCell>
                    <TableCell rowSpan={2} sx={{ ...columnBorderSx, ...tableMainHeaderSx }}>
                      参与情况
                    </TableCell>
                    <TableCell rowSpan={2} sx={{ ...columnBorderSx, ...tableMainHeaderSx }}>
                      技能掌握
                    </TableCell>
                    <TableCell rowSpan={2} sx={{ ...columnBorderSx, ...tableMainHeaderSx }}>
                      品格养成（最多选 3 项）
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ ...columnBorderSx, ...tableSubHeaderSx }}>
                      大类别
                    </TableCell>
                    <TableCell sx={{ ...columnBorderSx, ...tableSubHeaderSx }}>
                      细分类别
                    </TableCell>
                    <TableCell sx={{ ...columnBorderSx, ...tableSubHeaderSx }}>
                      具体劳动项目
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {structuredRows.map((row) => (
                    <SurveyRow
                      key={row.item.id}
                      row={row}
                      value={answers[row.item.id]}
                      traitsList={traitsList}
                      onUpdateAnswer={onUpdateAnswer}
                      onToggleTrait={onToggleTrait}
                    />
                  ))}
                </TableBody>
              </Table>
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={600} mb={2}>
              💡综合问题
            </Typography>
            <Stack spacing={3}>
              <Box>
                <Typography fontWeight={600} mb={1}>
                  1、经过这次劳动计划，你参与劳动的总体频率是？
                </Typography>
                <Stack spacing={1}>
                  <Box display="flex" alignItems="center">
                    <Typography color="text.secondary" sx={{ mr: 1 }}>
                      原来：
                    </Typography>
                    <RadioGroup
                      row
                      value={composite.q1.原来 ?? ""}
                      onChange={(event) =>
                        onCompositeRadio("q1", "原来", event.target.value)
                      }
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
                  </Box>
                  <Box display="flex" alignItems="center">
                    <Typography color="text.secondary" sx={{ mr: 1 }}>
                      现在：
                    </Typography>
                    <RadioGroup
                      row
                      value={composite.q1.现在 ?? ""}
                      onChange={(event) =>
                        onCompositeRadio("q1", "现在", event.target.value)
                      }
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
                  </Box>
                </Stack>
              </Box>

              <Divider />

              <Box>
                <Typography fontWeight={600} mb={1}>
                  2、经过这次劳动计划，你已经养成了积极参与劳动的习惯吗？
                </Typography>
                <Stack spacing={1}>
                  <Box display="flex" alignItems="center">
                    <Typography color="text.secondary" sx={{ mr: 1 }}>
                      原来：
                    </Typography>
                    <RadioGroup
                      row
                      value={composite.q2.原来 ?? ""}
                      onChange={(event) =>
                        onCompositeRadio("q2", "原来", event.target.value)
                      }
                    >
                      {habitOptions.map((option) => (
                        <FormControlLabel
                          key={option}
                          value={option}
                          control={<Radio />}
                          label={option}
                        />
                      ))}
                    </RadioGroup>
                  </Box>
                  <Box display="flex" alignItems="center">
                    <Typography color="text.secondary" sx={{ mr: 1 }}>
                      现在：
                    </Typography>
                    <RadioGroup
                      row
                      value={composite.q2.现在 ?? ""}
                      onChange={(event) =>
                        onCompositeRadio("q2", "现在", event.target.value)
                      }
                    >
                      {habitOptions.map((option) => (
                        <FormControlLabel
                          key={option}
                          value={option}
                          control={<Radio />}
                          label={option}
                        />
                      ))}
                    </RadioGroup>
                  </Box>
                </Stack>
              </Box>

              {!isFirstGrade && (
                <>
                  <Divider />
                  <Box>
                    <Typography fontWeight={600} mb={1}>
                      3、请为你在这次劳动计划中表现出的品质打个分吧（0-100）！
                    </Typography>
                    {stages.length === 0 ? (
                      <Typography color="text.secondary">
                        当前年级暂无阶段数据
                      </Typography>
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontSize: "1rem" }}>阶段</TableCell>
                            {metrics.map((metric) => (
                              <TableCell key={metric} sx={{ fontSize: "1rem", whiteSpace: "nowrap" }}>
                                {metric}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {stages.map((stage) => {
                            const gradeKey =
                              typeof studentGrade === "number"
                                ? String(studentGrade)
                                : "default";
                            const hintMap =
                              compositeStageHints[gradeKey] ?? compositeStageHints.default;
                            const hint = hintMap[stage] ?? '';
                            return (
                              <TableRow key={stage}>
                                <TableCell
                                  sx={{
                                    whiteSpace: "nowrap",
                                    width: { xs: 200, md: 260 },
                                    pr: 1,
                                    fontSize: "1rem",
                                  }}
                                >
                                  {stage}
                                  {hint ? (
                                    <Typography
                                      component="span"
                                      color="text.secondary"
                                      sx={{ ml: 1, fontSize: "1rem" }}
                                    >
                                      {hint}
                                    </Typography>
                                  ) : null}
                                </TableCell>
                              {metrics.map((metric) => (
                                <TableCell key={metric}>
                                  <TextField
                                    type="number"
                                    inputProps={{
                                      min: 0,
                                      max: 100,
                                      inputMode: "numeric",
                                      pattern: "[0-9]*",
                                    }}
                                    size="small"
                                    sx={{
                                      '& input[type="number"]': {
                                        MozAppearance: "textfield",
                                      },
                                      '& input[type="number"]::-webkit-outer-spin-button, & input[type="number"]::-webkit-inner-spin-button':
                                        {
                                          WebkitAppearance: "none",
                                          margin: 0,
                                        },
                                    }}
                                    value={composite.q3[stage]?.[metric] ?? ""}
                                    onChange={(
                                      event: ChangeEvent<HTMLInputElement>,
                                    ) =>
                                      onCompositeScore(
                                        stage,
                                        metric,
                                        event.target.value,
                                      )
                                    }
                                  />
                                </TableCell>
                              ))}
                            </TableRow>
                          );
                        })}
                        </TableBody>
                      </Table>
                    )}
                  </Box>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      </>
    );
  },
);

TeacherSurveyContent.displayName = "TeacherSurveyContent";

const EMPTY_COMPOSITE = {
  q1: { 原来: "", 现在: "" },
  q2: { 原来: "", 现在: "" },
  q3: {} as Record<string, Record<string, number>>,
};

const UNSAVED_PROMPT = "检测到尚未保存的修改，请先保存后再离开哦~";

const TeacherStudentPage = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const auth = useAuthStore();

  const [detail, setDetail] = useState<TeacherStudentDetail | null>(null);
  const [config, setConfig] = useState<SurveyConfig | null>(null);
  const [answers, setAnswers] = useState<Record<number, SurveyItemAnswer>>({});
  const [composite, setComposite] = useState(EMPTY_COMPOSITE);
  const [lockStatus, setLockStatus] = useState(false);
  const [parentNote, setParentNote] = useState("暂无家长评价~");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLock, setSavingLock] = useState(false);
  const [dirty, setDirty] = useState(false);

  const dirtyRef = useRef(false);

const traitsList = config?.traits ?? [];

  const stages = useMemo(() => {
    if ((detail?.student.grade ?? 0) === 1) {
      return [];
    }
    const question = config?.composite_questions.find(
      (item) => item.key === "q3",
    );
    if (!question?.rows_by_grade) {
      return [];
    }
    const gradeKey = detail?.student.grade?.toString() ?? "";
    return question.rows_by_grade[gradeKey] ?? [];
  }, [config?.composite_questions, detail?.student.grade]);

  const metrics = useMemo(() => {
    const question = config?.composite_questions.find(
      (item) => item.key === "q3",
    );
    const cols = question?.columns ?? [];
    return cols.length > 0 ? cols : DEFAULT_METRIC_LABELS;
  }, [config?.composite_questions]);

  const syncDetail = useCallback(async () => {
    if (!studentId) {
      return;
    }
    try {
      setLoading(true);
      const { data } = await client.get<TeacherStudentDetail>(
        `/teacher/students/${studentId}`,
      );
      const band = data.student.grade_band ?? "low";
      const [{ data: conf }] = await Promise.all([
        client.get<SurveyConfig>(`/config/survey?grade_band=${band}`),
      ]);
      setDetail(data);
      setConfig(conf);

      const mapped: Record<number, SurveyItemAnswer> = {};
      data.survey?.items?.forEach((item) => {
        mapped[item.survey_item_id] = {
          frequency: item.frequency ?? "",
          skill: item.skill ?? "",
          traits: item.traits ?? [],
        };
      });
      setAnswers(mapped);

      setComposite({
        q1: { 原来: "", 现在: "", ...(data.composite?.q1 ?? {}) },
        q2: { 原来: "", 现在: "", ...(data.composite?.q2 ?? {}) },
        q3: data.composite?.q3 ?? {},
      });

      setParentNote(
        data.parent_note?.content?.trim() || "暂无家长评价~",
      );
      setLockStatus(data.lock?.is_locked ?? false);
      setDirty(false);
    } catch (error) {
      toastError("加载学生问卷失败，请稍后重试~");
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    syncDetail();
  }, [syncDetail]);

  useEffect(() => {
    const school = auth.user?.school_name ?? "";
    const classNo = auth.user?.class_no ?? "";
    const gradeValue = auth.user?.grade;
    const gradePart = gradeValue != null ? String(gradeValue) : "";
    if (!school || !studentId) {
      return;
    }
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(
      `${protocol}://${window.location.host}/ws/teacher/${encodeURIComponent(`${school}-${gradePart}-${classNo}`)}`,
    );
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.student_id && payload.student_id === studentId) {
          syncDetail();
        }
      } catch {
        // ignore malformed payload
      }
    };
    return () => socket.close();
  }, [auth.user?.school_name, auth.user?.class_no, auth.user?.grade, studentId, syncDetail]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        event.preventDefault();
        event.returnValue = UNSAVED_PROMPT;
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  useEffect(() => {
    const guardState = { __teacherGuard: true };
    window.history.replaceState(guardState, "", window.location.href);
    const handlePop = () => {
      if (dirtyRef.current) {
        const ok = window.confirm(UNSAVED_PROMPT);
        if (!ok) {
          window.history.pushState(guardState, "", window.location.href);
          return;
        }
      }
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  useEffect(() => {
    dirtyRef.current = dirty;
    (window as any).__teacherDirtyGuard = dirty;
    return () => {
      (window as any).__teacherDirtyGuard = false;
    };
  }, [dirty]);

  const handleUpdateAnswer = useCallback(
    (itemId: number, partial: Partial<SurveyItemAnswer>) => {
      setAnswers((prev) => {
        const existing = prev[itemId] ?? EMPTY_ANSWER;
        return {
          ...prev,
          [itemId]: {
            ...existing,
            ...partial,
          },
        };
      });
      setDirty(true);
    },
    [],
  );

  const handleToggleTrait = useCallback((itemId: number, trait: string) => {
    setAnswers((prev) => {
      const existing = prev[itemId] ?? EMPTY_ANSWER;
      let traits = existing.traits ?? [];
      if (traits.includes(trait)) {
        traits = traits.filter((t) => t !== trait);
      } else {
        if (traits.length >= 3) {
          toastInfo("最多选择 3 个标签哦~");
          return prev;
        }
        traits = [...traits, trait];
      }
      setDirty(true);
      return {
        ...prev,
        [itemId]: { ...existing, traits },
      };
    });
  }, []);

  const handleCompositeRadio = useCallback(
    (questionKey: "q1" | "q2", rowKey: string, value: string) => {
      setComposite((prev) => ({
        ...prev,
        [questionKey]: {
          ...prev[questionKey],
          [rowKey]: value,
        },
      }));
      setDirty(true);
    },
    [],
  );

  const handleCompositeScore = useCallback(
    (stage: string, metric: string, raw: string) => {
      const numeric = raw ? Number(raw) : NaN;
      if (raw && (Number.isNaN(numeric) || numeric < 0 || numeric > 100)) {
        toastError("请输入 0-100 的数值哦~");
        return;
      }
      setComposite((prev) => {
        const nextStage = { ...(prev.q3[stage] ?? {}) };
        if (!raw) {
          delete nextStage[metric];
        } else {
          nextStage[metric] = numeric;
        }
        return {
          ...prev,
          q3: {
            ...prev.q3,
            [stage]: nextStage,
          },
        };
      });
      setDirty(true);
    },
    [],
  );

  const handleToggleLock = async (nextStatus: boolean) => {
    if (!studentId) return;
    setSavingLock(true);
    try {
      const { data } = await client.put<{
        is_locked: boolean;
        updated_at: string;
      }>(`/teacher/students/${studentId}/lock`, {
        is_locked: nextStatus,
      });
      setLockStatus(data.is_locked);
      toastInfo(
        data.is_locked
          ? "已锁定，学生端将无法继续修改"
          : "已解除锁定，学生端可以继续填写",
      );
    } finally {
      setSavingLock(false);
    }
  };

  const handleViewAi = useCallback(() => {
    if (!studentId) {
      return;
    }
    if (!detail?.survey || !config) {
      toastInfo("请先完成问卷提交~");
      return;
    }
    const expectedIds = new Set<number>();
    config.sections.forEach((section) => {
      section.items.forEach((item) => expectedIds.add(item.id));
    });
    const surveyItems = detail.survey.items ?? [];
    const answeredIds = new Set<number>(surveyItems.map((item) => item.survey_item_id));
    if (expectedIds.size === 0 || answeredIds.size !== expectedIds.size) {
      toastInfo("请先完成问卷提交~");
      return;
    }
    if (surveyItems.some((item) => !(item.frequency || "").trim() || !(item.skill || "").trim())) {
      toastInfo("请完整填写问卷信息~");
      return;
    }
    if (!detail.teacher_review) {
      toastInfo("请先完成教师评价~");
      return;
    }
    const q3 = (detail.composite as any)?.q3 ?? {};
    if (!q3 || typeof q3 !== "object") {
      toastInfo("请先完善综合问题信息~");
      return;
    }
    const hasIncompleteStage = stages.some((stage) => {
      const stageData = q3[stage];
      if (!stageData || typeof stageData !== "object") {
        return true;
      }
      return metrics.some((metric) => {
        const value = stageData[metric];
        return value === undefined || value === null || value === "";
      });
    });
    if (hasIncompleteStage) {
      toastInfo("请先完善综合问题信息~");
      return;
    }
    navigate(`/teacher/students/${studentId}/ai`);
  }, [studentId, detail, config, stages, metrics, navigate, toastInfo]);

const handleSaveChanges = async () => {
    if (!studentId) return;
    setSaving(true);
    try {
      const items = Object.entries(answers)
        .filter(
          ([, value]) =>
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

      const compositePayload = {
        q1: composite.q1,
        q2: composite.q2,
        q3: composite.q3,
      };

      const [{ data: savedSurvey }, { data: savedComposite }] = await Promise.all([
        client.put(`/teacher/students/${studentId}/survey`, { items }),
        client.put(`/teacher/students/${studentId}/composite`, compositePayload),
      ]);

      if (savedSurvey?.items) {
        const synced: Record<number, SurveyItemAnswer> = {};
        savedSurvey.items.forEach(
          (item: {
            survey_item_id: number;
            frequency: string | null;
            skill: string | null;
            traits: string[];
          }) => {
            synced[item.survey_item_id] = {
              frequency: item.frequency ?? "",
              skill: item.skill ?? "",
              traits: item.traits ?? [],
            };
          },
        );
        setAnswers(synced);
      }

      if (savedComposite) {
        setComposite({
          q1: { 原来: "", 现在: "", ...(savedComposite.q1 ?? {}) },
          q2: { 原来: "", 现在: "", ...(savedComposite.q2 ?? {}) },
          q3: savedComposite.q3 ?? {},
        });
      }

      setDirty(false);
      toastSuccess("修改已保存！");
    } catch (error: any) {
      const message =
        error?.response?.data?.detail ?? "保存失败，请稍后重试~";
      toastError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    if (dirty && !window.confirm(UNSAVED_PROMPT)) {
      return;
    }
    navigate("/teacher");
  };

  if (loading || !detail || !config) {
    return (
      <Stack alignItems="center" justifyContent="center" minHeight="50vh">
        <CircularProgress color="primary" />
        <Typography mt={2} color="text.secondary">
          正在加载，请稍候...
        </Typography>
      </Stack>
    );
  }

  const isFirstGrade = detail.student.grade === 1;
  return (
    <Stack spacing={3}>
      <Stack spacing={0.5}>
        <Typography variant="h5" fontWeight={700}>
          {detail.student.student_name}
        </Typography>
      </Stack>

      <TeacherSurveyContent
        config={config}
        answers={answers}
        composite={composite}
        traitsList={traitsList}
        stages={stages}
        studentGrade={detail.student.grade ?? null}
        isFirstGrade={isFirstGrade}
        metrics={metrics}
        onUpdateAnswer={handleUpdateAnswer}
        onToggleTrait={handleToggleTrait}
        onCompositeRadio={handleCompositeRadio}
        onCompositeScore={handleCompositeScore}
      />

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        justifyContent="flex-start"
      >
        <Button
          variant="contained"
          size="large"
          onClick={handleSaveChanges}
          disabled={saving || !dirty}
        >
          {saving ? "保存中..." : "保存修改"}
        </Button>
      </Stack>

      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={2}>
            👨‍👩‍👧‍👦家长评价（请围绕孩子的劳动表现展开）
          </Typography>
          <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
            {parentNote}
          </Typography>
        </CardContent>
      </Card>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        justifyContent="flex-start"
      >
        <Button
          variant="outlined"
          onClick={handleViewAi}
        >
          🦋查看小彩蝶的智能综评
        </Button>
        <Button
          variant="contained"
          color={lockStatus ? "secondary" : "primary"}
          onClick={() => handleToggleLock(!lockStatus)}
          disabled={savingLock}
        >
          {savingLock
            ? "处理中..."
            : lockStatus
            ? "🔑解除锁定"
            : "🔒锁定该学生信息"}
        </Button>
        <Button variant="outlined" onClick={handleBack}>
          ↩️返回查看班级列表
        </Button>
      </Stack>
    </Stack>
  );
};

export default TeacherStudentPage;
