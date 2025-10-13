import React, {
  ChangeEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
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
  Checkbox,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import client from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { toastError, toastInfo, toastSuccess } from "../../components/toast";

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

const surveyFrequencyOptions = ["每天", "经常", "偶尔"]
const frequencyOptions = ["每天", "经常", "偶尔", "从不"];
const skillOptions = ["熟练", "一般", "不会"];
const habitOptions = ["完全同意", "比较同意", "部分同意", "不同意"];

type SurveyContentProps = {
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
  savingSurvey: boolean;
  onUpdateAnswer: (itemId: number, partial: Partial<SurveyItemAnswer>) => void;
  onToggleTrait: (itemId: number, trait: string) => void;
  onCompositeRadio: (
    questionKey: "q1" | "q2",
    rowKey: string,
    value: string,
  ) => void;
  onCompositeScore: (
    stage: string,
    metric: string,
    raw: string,
  ) => void;
  onSaveSurvey: () => void;
};

const EMPTY_ANSWER: SurveyItemAnswer = {
  frequency: "",
  skill: "",
  traits: [],
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
            minWidth: 140,
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
              onUpdateAnswer(row.item.id, {
                frequency: event.target.value,
              })
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
              onUpdateAnswer(row.item.id, {
                skill: event.target.value,
              })
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
    const prevTraits = prev.value.traits;
    const nextTraits = next.value.traits;
    if (prevTraits.length !== nextTraits.length) {
      return false;
    }
    return prevTraits.every((trait, index) => trait === nextTraits[index]);
  },
);


const SurveyContent = memo(
  ({
    config,
    answers,
    composite,
    traitsList,
    stages,
    isFirstGrade,
    savingSurvey,
    onUpdateAnswer,
    onToggleTrait,
    onCompositeRadio,
    onCompositeScore,
    onSaveSurvey,
  }: SurveyContentProps) => {
    const majorTotals = useMemo(() => {
      const totals = new Map<string, number>();
      config.sections.forEach((section) => {
        totals.set(
          section.major_category,
          (totals.get(section.major_category) ?? 0) + section.items.length,
        );
      });
      return totals;
    }, [config.sections]);

    const structuredRows = useMemo(() => {
      const rows: Array<{
        major: string;
        minor: string;
        item: { id: number; prompt: string };
        showMajor: boolean;
        showMinor: boolean;
        majorRowSpan: number;
        minorRowSpan: number;
      }> = [];
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
              ? majorTotals.get(majorKey) ?? section.items.length
              : 0,
            minorRowSpan: index === 0 ? section.items.length : 0,
          });
        });
      });
      return rows;
    }, [config.sections, majorTotals]);

    return (
      <>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={600} mb={2}>
              学生自评表
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
                    <TableCell sx={{ ...columnBorderSx, ...tableSubHeaderSx }}>大类别</TableCell>
                    <TableCell sx={{ ...columnBorderSx, ...tableSubHeaderSx }}>细分类别</TableCell>
                    <TableCell sx={{ ...columnBorderSx, ...tableSubHeaderSx }}>具体劳动项目</TableCell>
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
                      onChange={(event) => onCompositeRadio("q1", "原来", event.target.value)}
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
                      onChange={(event) => onCompositeRadio("q1", "现在", event.target.value)}
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
                      onChange={(event) => onCompositeRadio("q2", "原来", event.target.value)}
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
                      onChange={(event) => onCompositeRadio("q2", "现在", event.target.value)}
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
                        当前年级暂无阶段数据，可跳过此项
                      </Typography>
                    ) : (
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>阶段</TableCell>
                            <TableCell>坚毅担责</TableCell>
                            <TableCell>勤劳诚实</TableCell>
                            <TableCell>合作智慧</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {stages.map((stage) => (
                            <TableRow key={stage}>
                              <TableCell>{stage}</TableCell>
                              {["坚毅担责", "勤劳诚实", "合作智慧"].map((metric) => (
                                <TableCell key={metric}>
                                  <TextField
                                    type="number"
                                    inputProps={{ min: 0, max: 100 }}
                                    size="small"
                                    value={composite.q3[stage]?.[metric] ?? ""}
                                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
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

        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Button
            variant="contained"
            color="primary"
            onClick={onSaveSurvey}
            disabled={savingSurvey}
          >
            {savingSurvey ? "保存中..." : "保存问卷信息"}
          </Button>
        </Stack>
      </>
    );
  },
);


SurveyContent.displayName = "SurveyContent";

const SurveyPage = () => {
  const navigate = useNavigate();
  const auth = useAuthStore();
  const grade = auth.user?.grade ?? 1;
  const isFirstGrade = grade === 1;

  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<SurveyConfig | null>(null);
  const [answers, setAnswers] = useState<Record<number, SurveyItemAnswer>>({});
  const [composite, setComposite] = useState<{
    q1: Record<string, string>;
    q2: Record<string, string>;
    q3: Record<string, Record<string, number>>;
  }>({ q1: { 原来: "", 现在: "" }, q2: { 原来: "", 现在: "" }, q3: {} });
  const [parentNote, setParentNote] = useState("");
  const [savingSurvey, setSavingSurvey] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
const [loadError, setLoadError] = useState<string | null>(null);
const [dirtySurvey, setDirtySurvey] = useState(false);
const [dirtyNote, setDirtyNote] = useState(false);
const dirtyRef = useRef(false);
const UNSAVED_PROMPT = "检测到问卷信息有修改，请注意保存！";
const traitsList = config?.traits ?? [];

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        const gradeBand = auth.user?.grade_band ?? "low";
        const [{ data: conf }, { data: survey }, { data: comp }, { data: note }] =
          await Promise.all([
            client.get(`/config/survey?grade_band=${gradeBand}`),
            client.get("/students/me/survey"),
            client.get("/students/me/composite"),
            client.get("/students/me/parent-note"),
          ]);
        if (!isMounted) {
          return;
        }
        setConfig(conf);

        if (survey?.items) {
          const mapped: Record<number, SurveyItemAnswer> = {};
          survey.items.forEach((item: any) => {
            mapped[item.survey_item_id] = {
              frequency: item.frequency,
              skill: item.skill,
              traits: item.traits ?? [],
            };
          });
          setAnswers(mapped);
        } else {
          setAnswers({});
        }

        if (comp) {
          setComposite({
            q1: comp.q1 ?? { 原来: "", 现在: "" },
            q2: comp.q2 ?? { 原来: "", 现在: "" },
            q3: comp.q3 ?? {},
          });
        } else {
          setComposite({ q1: { 原来: "", 现在: "" }, q2: { 原来: "", 现在: "" }, q3: {} });
        }

        if (note?.content !== undefined) {
          setParentNote(note.content);
        } else {
          setParentNote("");
        }
        setDirtySurvey(false);
        setDirtyNote(false);
      } catch (error) {
        if (isMounted) {
          toastError("加载问卷数据失败，请稍后重试。");
          setConfig(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [auth.user?.grade_band]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirtySurvey || dirtyNote) {
        event.preventDefault();
        event.returnValue = UNSAVED_PROMPT;
      }
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirtySurvey, dirtyNote]);

  useEffect(() => {
    dirtyRef.current = dirtySurvey || dirtyNote;
    (window as any).__surveyDirtyGuard = dirtyRef.current;
    return () => {
      (window as any).__surveyDirtyGuard = false;
    };
  }, [dirtySurvey, dirtyNote]);

  useEffect(() => {
    const guardState = { __surveyGuard: true };
    window.history.replaceState(guardState, "", window.location.href);

    const handlePopState = () => {
      if (dirtyRef.current) {
        const confirmLeave = window.confirm(UNSAVED_PROMPT);
        if (!confirmLeave) {
          window.history.pushState(guardState, "", window.location.href);
          return;
        }
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const stages = useMemo(() => {
    const question = config?.composite_questions.find((item) => item.key === "q3");
    if (!question?.rows_by_grade) {
      return [];
    }
    return question.rows_by_grade[String(grade)] ?? [];
  }, [config, grade]);

  const handleUpdateAnswer = useCallback(
    (itemId: number, partial: Partial<SurveyItemAnswer>) => {
      setAnswers((prev) => {
        const existing = prev[itemId] ?? {
          frequency: "",
          skill: "",
          traits: [],
        };
        return {
          ...prev,
          [itemId]: {
            ...existing,
            ...partial,
          },
        };
      });
      setDirtySurvey(true);
    },
    [],
  );

  const handleTraitToggle = useCallback((itemId: number, trait: string) => {
    setAnswers((prev) => {
      const existing = prev[itemId] ?? {
        frequency: "",
        skill: "",
        traits: [],
      };
      let traits = existing.traits ?? [];
      if (traits.includes(trait)) {
        traits = traits.filter((t) => t !== trait);
      } else {
        if (traits.length >= 3) {
          toastError("品格养成最多选择 3 项哦~");
          return prev;
        }
        traits = [...traits, trait];
      }
      setDirtySurvey(true);
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
      setDirtySurvey(true);
    },
    [],
  );

  const handleCompositeScore = useCallback(
    (stage: string, metric: string, raw: string) => {
      const numeric = raw ? Number(raw) : NaN;
      if (raw && (Number.isNaN(numeric) || numeric < 0 || numeric > 100)) {
        toastError("请填写0-100 之间的数");
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
      setDirtySurvey(true);
    },
    [],
  );

  const saveSurvey = useCallback(async () => {
    setSavingSurvey(true);
    try {
      const payload = Object.entries(answers)
        .filter(([_, value]) => value.frequency && value.skill)
        .map(([id, value]) => ({
          survey_item_id: Number(id),
          frequency: value.frequency,
          skill: value.skill,
          traits: value.traits,
        }));

      await client.put("/students/me/survey", { items: payload });
      await client.put("/students/me/composite", composite);
      toastSuccess("问卷信息已保存");
      setDirtySurvey(false);
    } finally {
      setSavingSurvey(false);
    }
  }, [answers, composite]);

  const saveParentNote = useCallback(async () => {
    if (parentNote.length > 300) {
      toastError("家长寄语需300 字以内");
      return;
    }
    setSavingNote(true);
    try {
      await client.put("/students/me/parent-note", { content: parentNote });
      toastSuccess("家长寄语已保存");
      setDirtyNote(false);
    } finally {
      setSavingNote(false);
    }
  }, [parentNote]);

  const goReview = useCallback(async () => {
    if (dirtySurvey || dirtyNote) {
      const ok = window.confirm(UNSAVED_PROMPT);
      if (!ok) return;
    }
    try {
      await client.get("/students/me/teacher-review");
      navigate("/student/review");
    } catch (error: any) {
      const message =
        error?.response?.status === 404
          ? "老师还未对你做出评价哦，请耐心等待~"
          : error?.response?.data?.detail ?? "暂时无法查看教师评价";
      toastInfo(message);
    }
  }, [dirtySurvey, dirtyNote, navigate]);

  const goAi = useCallback(() => {
    if (dirtySurvey || dirtyNote) {
      const ok = window.confirm(UNSAVED_PROMPT);
      if (!ok) {
        return;
      }
    }
    navigate("/student/ai");
  }, [dirtySurvey, dirtyNote, navigate]);

  if (loading || !config) {
    return (
      <Stack alignItems="center" justifyContent="center" minHeight="50vh">
        <CircularProgress color="primary" />
        <Typography mt={2}>加载中，请稍候~</Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={4}>
      <SurveyContent
        config={config}
        answers={answers}
        composite={composite}
        traitsList={traitsList}
        stages={stages}
        isFirstGrade={isFirstGrade}
        savingSurvey={savingSurvey}
        onUpdateAnswer={handleUpdateAnswer}
        onToggleTrait={handleTraitToggle}
        onCompositeRadio={handleCompositeRadio}
        onCompositeScore={handleCompositeScore}
        onSaveSurvey={saveSurvey}
      />

      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={2}>
            家长寄语
          </Typography>
          <Stack spacing={2}>
            <TextField
              multiline
              minRows={6}
              fullWidth
              placeholder="对您的孩子说些什么吧，但也不要太多哦~ 300字以内就行啦~"
              value={parentNote}
              onChange={(event) => {
                setParentNote(event.target.value);
                setDirtyNote(true);
              }}
              helperText={`${parentNote.length}/300`}
            />
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <Button
                variant="contained"
                color="primary"
                onClick={saveParentNote}
                disabled={savingNote}
              >
                {savingNote ? "保存中..." : "保存家长寄语"}
              </Button>
              <Button variant="outlined" onClick={goReview}>
                查看老师对你的评价              </Button>
              <Button variant="outlined" onClick={goAi}>
                查看彩小蝶对你的综合评语
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
};

export default SurveyPage;




