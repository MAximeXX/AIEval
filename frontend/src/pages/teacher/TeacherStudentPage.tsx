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
  Switch,
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

type TeacherReview = {
  selected_traits: string[];
  rendered_text: string;
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
  teacher_review: TeacherReview | null;
  lock: {
    is_locked: boolean;
    updated_at?: string;
  } | null;
};

const surveyFrequencyOptions = ["每天", "经常", "偶尔"];
const frequencyOptions = ["每天", "经常", "偶尔", "几乎不"];
const skillOptions = ["熟练", "一般", "需要帮助"];
const habitOptions = ["完全同意", "比较同意", "基本不同意", "不同意"];
const metricLabels = ["劳动最棒", "动手真棒", "劳动形象佳"];

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
  isFirstGrade: boolean;
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
    isFirstGrade,
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
              学生问卷
            </Typography>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 960 }}>
                <TableHead>
                  <TableRow>
                    <TableCell colSpan={3} sx={{ ...columnBorderSx, ...tableMainHeaderSx }}>
                      劳动项目
                    </TableCell>
                    <TableCell rowSpan={2} sx={{ ...columnBorderSx, ...tableMainHeaderSx }}>
                      参与频率
                    </TableCell>
                    <TableCell rowSpan={2} sx={{ ...columnBorderSx, ...tableMainHeaderSx }}>
                      能力表现
                    </TableCell>
                    <TableCell rowSpan={2} sx={{ ...columnBorderSx, ...tableMainHeaderSx }}>
                      品质标签（最多 3 项）
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ ...columnBorderSx, ...tableSubHeaderSx }}>
                      大类
                    </TableCell>
                    <TableCell sx={{ ...columnBorderSx, ...tableSubHeaderSx }}>
                      小类
                    </TableCell>
                    <TableCell sx={{ ...columnBorderSx, ...tableSubHeaderSx }}>
                      具体项目
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
              综合问题
            </Typography>
            <Stack spacing={3}>
              <Box>
                <Typography fontWeight={600} mb={1}>
                  1. 你在彩蝶劳动益美行计划中的参与频率？
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
                  2. 通过计划，你形成良好劳动习惯的程度？
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
                      3. 请为各阶段的劳动表现打分（0-100 分）
                    </Typography>
                    {stages.length === 0 ? (
                      <Typography color="text.secondary">
                        当前年级暂无阶段数据
                      </Typography>
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>阶段</TableCell>
                            {metricLabels.map((metric) => (
                              <TableCell key={metric}>{metric}</TableCell>
                            ))}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {stages.map((stage) => (
                            <TableRow key={stage}>
                              <TableCell>{stage}</TableCell>
                              {metricLabels.map((metric) => (
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
                          ))}
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
  const [selectedTraits, setSelectedTraits] = useState<string[]>([]);
  const [lockStatus, setLockStatus] = useState(false);
  const [renderedReview, setRenderedReview] = useState("");
  const [parentNote, setParentNote] = useState("暂无家长寄语~");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLock, setSavingLock] = useState(false);
  const [dirty, setDirty] = useState(false);

  const dirtyRef = useRef(false);

  const traitsList = config?.traits ?? [];

  const stages = useMemo(() => {
    const question = config?.composite_questions.find(
      (item) => item.key === "q3",
    );
    if (!question?.rows_by_grade) {
      return [];
    }
    const gradeKey = detail?.student.grade?.toString() ?? "";
    return question.rows_by_grade[gradeKey] ?? [];
  }, [config?.composite_questions, detail?.student.grade]);

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
        data.parent_note?.content?.trim() || "暂无家长寄语~",
      );
      setSelectedTraits(data.teacher_review?.selected_traits ?? []);
      setRenderedReview(data.teacher_review?.rendered_text ?? "");
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
    const school = auth.user?.school_name;
    const classNo = auth.user?.class_no;
    if (!school || !classNo || !studentId) {
      return;
    }
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const socket = new WebSocket(
      `${protocol}://${window.location.host}/ws/teacher/${encodeURIComponent(`${school}-${classNo}`)}`,
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
  }, [auth.user?.school_name, auth.user?.class_no, studentId, syncDetail]);

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
    (window as any).__surveyDirtyGuard = dirty;
  }, [dirty]);

  useEffect(
    () => () => {
      (window as any).__surveyDirtyGuard = false;
    },
    [],
  );

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

  const toggleReviewTrait = useCallback((trait: string) => {
    setSelectedTraits((prev) => {
      if (prev.includes(trait)) {
        setDirty(true);
        return prev.filter((item) => item !== trait);
      }
      if (prev.length >= 6) {
        toastInfo("最多选择 6 个关键词哦~");
        return prev;
      }
      setDirty(true);
      return [...prev, trait];
    });
  }, []);

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

  const handleSubmit = async () => {
    if (!studentId) return;
    if (selectedTraits.length === 0) {
      toastInfo("请至少选择一个教师评价关键词哦~");
      return;
    }
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

      const [
        { data: savedSurvey },
        { data: savedComposite },
        { data: savedReview },
      ] = await Promise.all([
        client.put(`/teacher/students/${studentId}/survey`, { items }),
        client.put(`/teacher/students/${studentId}/composite`, compositePayload),
        client.post(`/teacher/students/${studentId}/review`, {
          selected_traits: selectedTraits,
        }),
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

      if (savedReview) {
        setSelectedTraits(savedReview.selected_traits ?? selectedTraits);
        setRenderedReview(savedReview.rendered_text ?? "");
      }

      setDirty(false);
      toastSuccess("保存并提交成功！");
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
  const previewText =
    selectedTraits.length > 0
      ? `亲爱的蝶宝：\n在劳动中，老师看到了你的${selectedTraits.join(
          "、",
        )}，希望你再接再厉，成长为坚毅担责、勤劳诚实、合作智慧的“小彩蝶”！`
      : renderedReview || "请在上方选择关键词生成教师评价内容哦~";

  return (
    <Stack spacing={3}>
      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h5" fontWeight={700}>
            {detail.student.student_name}
          </Typography>
          <Typography color="text.secondary">
            {detail.student.grade}年级 {detail.student.class_no}班 · 学号{" "}
            {detail.student.student_no || "--"}
          </Typography>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <FormControlLabel
            control={
              <Switch
                checked={lockStatus}
                onChange={(event) => handleToggleLock(event.target.checked)}
                disabled={savingLock}
              />
            }
            label={lockStatus ? "已锁定" : "允许学生修改"}
          />
          <Button variant="outlined" onClick={handleBack}>
            返回学生列表
          </Button>
        </Stack>
      </Stack>

      <TeacherSurveyContent
        config={config}
        answers={answers}
        composite={composite}
        traitsList={traitsList}
        stages={stages}
        isFirstGrade={isFirstGrade}
        onUpdateAnswer={handleUpdateAnswer}
        onToggleTrait={handleToggleTrait}
        onCompositeRadio={handleCompositeRadio}
        onCompositeScore={handleCompositeScore}
      />

      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={2}>
            家长寄语
          </Typography>
          <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
            {parentNote}
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={1.5}>
            教师评价
          </Typography>
          <Typography color="text.secondary" mb={3}>
            亲爱的蝶宝：在劳动中，老师看到了你的 ________ ，希望你再接再厉，成长为坚毅担责、勤劳诚实、合作智慧的“小彩蝶”！请选择 1-6 个关键词填入空格。
          </Typography>
          <Stack
            direction="row"
            spacing={2}
            sx={{
              flexWrap: "nowrap",
              overflowX: "auto",
              "& > *": { flex: "0 0 auto" },
            }}
          >
            {traitsList.map((trait) => (
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

          <Box
            mt={3}
            p={2}
            sx={{
              borderRadius: 2,
              backgroundColor: "rgba(255, 138, 128, 0.08)",
              border: "1px dashed",
              borderColor: "primary.light",
            }}
          >
            <Typography
              variant="subtitle2"
              color="primary"
              fontWeight={600}
              mb={1}
            >
              预览
            </Typography>
            <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
              {previewText}
            </Typography>
          </Box>

          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            justifyContent="flex-end"
            mt={4}
          >
            <Button
              variant="contained"
              size="large"
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? "提交中..." : "保存并提交"}
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
};

export default TeacherStudentPage;
