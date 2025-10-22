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

type StudentSurveyItem = {
  id: number;
  survey_item_id: number;
  frequency: string | null;
  skill: string | null;
  traits: string[];
};

type StudentSurveyResponse = {
  id: string | null;
  items: StudentSurveyItem[];
};

const surveyFrequencyOptions = ["每天", "经常", "偶尔"];
const frequencyOptions = ["每天", "经常", "偶尔", "从不"];
const skillOptions = ["熟练", "一般", "不会"];
const habitOptions = ["完全同意", "比较同意", "部分同意", "不同意"];
const compositeMetrics = ["坚毅担责", "勤劳诚实", "合作智慧"];
const compositeStageHints: Record<
  string,
  Record<string, string>
> = {
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
const ENABLE_SURVEY_AUTOFILL = import.meta.env.VITE_ENABLE_SURVEY_AUTOFILL === "true";

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
  grade: number;
  isFirstGrade: boolean;
  savingSurvey: boolean;
  isLocked: boolean;
  onUpdateAnswer: (itemId: number, partial: Partial<SurveyItemAnswer>) => void;
  onToggleTrait: (itemId: number, trait: string) => void;
  onCompositeRadio: (
    questionKey: "q1" | "q2",
    rowKey: string,
    value: string,
  ) => void;
  onCompositeScore: (stage: string, metric: string, raw: string) => void;
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
  ({
    row,
    value,
    traitsList,
    onUpdateAnswer,
    onToggleTrait,
  }: SurveyRowProps) => {
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
    grade,
    isFirstGrade,
    savingSurvey,
    isLocked,
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
              ? (majorTotals.get(majorKey) ?? section.items.length)
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
              📑学生自评表
            </Typography>
            <Box sx={{ overflowX: "auto" }}>
              <Table size="small" sx={{ minWidth: 960 }}>
                <TableHead>
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      sx={{ ...columnBorderSx, ...tableMainHeaderSx }}
                    >
                      劳动项目
                    </TableCell>
                    <TableCell
                      rowSpan={2}
                      sx={{ ...columnBorderSx, ...tableMainHeaderSx }}
                    >
                      参与情况
                    </TableCell>
                    <TableCell
                      rowSpan={2}
                      sx={{ ...columnBorderSx, ...tableMainHeaderSx }}
                    >
                      技能掌握
                    </TableCell>
                    <TableCell
                      rowSpan={2}
                      sx={{ ...columnBorderSx, ...tableMainHeaderSx }}
                    >
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
              {!isFirstGrade && stages.length > 0 && (
                <>
                  <Divider />
                  <Box>
                    <Typography fontWeight={600} mb={1}>
                      3、请为你在这次劳动计划中表现出的品格打个分吧（0-100）！
                    </Typography>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontSize: "1rem" }}>阶段</TableCell>
                          <TableCell sx={{ fontSize: "1rem" }}>坚毅担责</TableCell>
                          <TableCell sx={{ fontSize: "1rem" }}>勤劳诚实</TableCell>
                          <TableCell sx={{ fontSize: "1rem" }}>合作智慧</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {stages.map((stage) => {
                          const hintMap =
                            compositeStageHints[String(grade)] ??
                            compositeStageHints.default;
                          const hint = hintMap[stage] ?? "";
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
                                    sx={{ ml: 1, fontSize: "0.85rem" }}
                                  >
                                    {hint}
                                  </Typography>
                                ) : null}
                              </TableCell>
                              {["坚毅担责", "勤劳诚实", "合作智慧"].map((metric) => (
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
                                    '& input[type="number"]::-webkit-outer-spin-button, & input[type="number"]::-webkit-inner-spin-button': {
                                      WebkitAppearance: "none",
                                      margin: 0,
                                    },
                                  }}
                                  value={composite.q3[stage]?.[metric] ?? ""}
                                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                                    onCompositeScore(stage, metric, event.target.value)
                                  }
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                      </TableBody>
                    </Table>
                  </Box>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={2}
          alignItems={{ xs: "flex-start", md: "center" }}
        >
          <Button
            variant="contained"
            color="primary"
            onClick={onSaveSurvey}
            disabled={savingSurvey || isLocked}
          >
            {savingSurvey ? "保存中..." : "保存问卷信息"}
          </Button>
          {isLocked && (
            <Typography color="red" variant="body2">
              老师已锁定信息，暂时无法修改~
            </Typography>
          )}
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
  const [checkingAi, setCheckingAi] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [dirtySurvey, setDirtySurvey] = useState(false);
  const [dirtyNote, setDirtyNote] = useState(false);
  const dirtyRef = useRef(false);
  const lockedRef = useRef(false);
  const UNSAVED_PROMPT = "检测到问卷信息有修改，请注意保存！";
  const traitsList = config?.traits ?? [];

  useEffect(() => {
    lockedRef.current = isLocked;
  }, [isLocked]);

  const guardLocked = useCallback(() => {
    if (!lockedRef.current) {
      return false;
    }
    toastInfo("你无法修改了哦~");
    return true;
  }, []);

  useEffect(() => {
    const initial = (window as any).__studentLockStatus;
    if (typeof initial === "boolean") {
      setIsLocked(initial);
    }
  }, []);

  useEffect(() => {
    const listener = (event: Event) => {
      const customEvent = event as CustomEvent<boolean>;
      if (typeof customEvent.detail === "boolean") {
        setIsLocked(customEvent.detail);
      }
    };
    window.addEventListener("student-lock-changed", listener as EventListener);
    return () => {
      window.removeEventListener(
        "student-lock-changed",
        listener as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        const gradeBand = auth.user?.grade_band ?? "low";
        const [
          { data: conf },
          { data: survey },
          { data: comp },
          { data: note },
        ] = await Promise.all([
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
              frequency: item.frequency ?? "",
              skill: item.skill ?? "",
              traits: item.traits ?? [],
            };
          });
          setAnswers(mapped);
        } else {
          setAnswers({});
        }
        const locked = Boolean(survey?.is_locked);
        setIsLocked(locked);
        (window as any).__studentLockStatus = locked;

        if (comp) {
          setComposite({
            q1: comp.q1 ?? { 原来: "", 现在: "" },
            q2: comp.q2 ?? { 原来: "", 现在: "" },
            q3: comp.q3 ?? {},
          });
        } else {
          setComposite({
            q1: { 原来: "", 现在: "" },
            q2: { 原来: "", 现在: "" },
            q3: {},
          });
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
    const question = config?.composite_questions.find(
      (item) => item.key === "q3",
    );
    if (!question?.rows_by_grade) {
      return [];
    }
    return question.rows_by_grade[String(grade)] ?? [];
  }, [config, grade]);

  const ensureSurveyComplete = useCallback(async (): Promise<boolean> => {
    if (!config) {
      toastError("问卷配置尚未加载完成，请稍后再试~");
      return false;
    }
    try {
      const { data: surveyData } = await client.get<StudentSurveyResponse>(
        "/students/me/survey",
      );
      const expectedIds = new Set<number>();
      config.sections.forEach((section) => {
        section.items.forEach((item) => expectedIds.add(item.id));
      });
      const expectedCount = expectedIds.size;
      const answeredItems = surveyData?.items ?? [];
      if (expectedCount === 0) {
        return true;
      }
      if (!surveyData?.id || answeredItems.length === 0) {
        toastInfo("请补全问卷信息~");
        return false;
      }
      const answeredMap = new Map<number, (typeof answeredItems)[number]>();
      let hasEmptyField = false;
      answeredItems.forEach((item) => {
        answeredMap.set(item.survey_item_id, item);
        if (!item.frequency || !item.skill) {
          hasEmptyField = true;
        }
      });
      const hasMissingItem =
        expectedCount > 0 &&
        ([...expectedIds].some((id) => !answeredMap.has(id)) ||
          answeredMap.size !== expectedCount);
      if (hasMissingItem || hasEmptyField) {
        toastInfo("请补全问卷信息~");
        return false;
      }
      return true;
    } catch (error) {
      toastError("暂时无法校验问卷信息，请稍后再试~");
      return false;
    }
  }, [config]);

  const handleUpdateAnswer = useCallback(
    (itemId: number, partial: Partial<SurveyItemAnswer>) => {
      if (guardLocked()) {
        return;
      }
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
    [guardLocked],
  );

  const handleTraitToggle = useCallback((itemId: number, trait: string) => {
    if (guardLocked()) {
      return;
    }
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
  }, [guardLocked]);

  const handleCompositeRadio = useCallback(
    (questionKey: "q1" | "q2", rowKey: string, value: string) => {
      if (guardLocked()) {
        return;
      }
      setComposite((prev) => ({
        ...prev,
        [questionKey]: {
          ...prev[questionKey],
          [rowKey]: value,
        },
      }));
      setDirtySurvey(true);
    },
    [guardLocked],
  );

  const handleCompositeScore = useCallback(
    (stage: string, metric: string, raw: string) => {
      if (guardLocked()) {
        return;
      }
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
    [guardLocked],
  );

  const handleAutofill = useCallback(() => {
    if (!ENABLE_SURVEY_AUTOFILL) {
      return;
    }
    if (guardLocked()) {
      return;
    }
    if (!config) {
      toastError("问卷配置尚未加载完成，请稍后再试~");
      return;
    }
    const randomInt = (min: number, max: number) =>
      Math.floor(Math.random() * (max - min + 1)) + min;
    const pickRandom = <T,>(options: T[]): T =>
      options[randomInt(0, options.length - 1)];
    const pickTraits = (list: string[]): string[] => {
      if (list.length === 0) {
        return [];
      }
      const limit = Math.min(3, list.length);
      const count = randomInt(1, limit);
      const shuffled = [...list];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = randomInt(0, i);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled.slice(0, count);
    };

    const generatedAnswers: Record<number, SurveyItemAnswer> = {};
    config.sections.forEach((section) => {
      section.items.forEach((item) => {
        generatedAnswers[item.id] = {
          frequency: pickRandom(surveyFrequencyOptions),
          skill: pickRandom(skillOptions),
          traits: pickTraits(traitsList),
        };
      });
    });

    const generatedComposite = {
      q1: {
        原来: pickRandom(frequencyOptions),
        现在: pickRandom(frequencyOptions),
      },
      q2: {
        原来: pickRandom(habitOptions),
        现在: pickRandom(habitOptions),
      },
      q3:
        stages.length === 0
          ? {}
          : stages.reduce<Record<string, Record<string, number>>>(
              (acc, stage) => {
                acc[stage] = compositeMetrics.reduce(
                  (metricAcc, metric) => ({
                    ...metricAcc,
                    [metric]: randomInt(0, 100),
                  }),
                  {} as Record<string, number>,
                );
                return acc;
              },
              {},
            ),
    };

    setAnswers(generatedAnswers);
    setComposite(generatedComposite);
    setDirtySurvey(true);
    toastInfo("已随机填写问卷，请确认后保存~");
  }, [config, guardLocked, stages, traitsList]);

  const saveSurvey = useCallback(async () => {
    if (guardLocked()) {
      return;
    }
    setSavingSurvey(true);
    try {
      const payload = Object.entries(answers)
        .filter(
          ([_, value]) =>
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

      const { data: savedSurvey } = await client.put("/students/me/survey", {
        items: payload,
      });
      const { data: savedComposite } = await client.put(
        "/students/me/composite",
        composite,
      );
      const locked = Boolean(savedSurvey?.is_locked);
      setIsLocked(locked);
      (window as any).__studentLockStatus = locked;

      if (savedSurvey?.items) {
        const syncedAnswers: Record<number, SurveyItemAnswer> = {};
        savedSurvey.items.forEach(
          (item: {
            survey_item_id: number;
            frequency: string | null;
            skill: string | null;
            traits: string[];
          }) => {
            syncedAnswers[item.survey_item_id] = {
              frequency: item.frequency ?? "",
              skill: item.skill ?? "",
              traits: item.traits ?? [],
            };
          },
        );
        setAnswers(syncedAnswers);
      }
      if (savedComposite) {
        setComposite({
          q1: savedComposite.q1 ?? { 原来: "", 现在: "" },
          q2: savedComposite.q2 ?? { 原来: "", 现在: "" },
          q3: savedComposite.q3 ?? {},
        });
      }
      toastSuccess("问卷信息已保存");
      setDirtySurvey(false);
    } finally {
      setSavingSurvey(false);
    }
  }, [answers, composite, guardLocked]);

  const saveParentNote = useCallback(async () => {
    if (guardLocked()) {
      return;
    }
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
  }, [guardLocked, parentNote]);

  const goReview = useCallback(async () => {
    if (dirtySurvey || dirtyNote) {
      const ok = window.confirm(UNSAVED_PROMPT);
      if (!ok) return;
    }
    const surveyOk = await ensureSurveyComplete();
    if (!surveyOk) {
      return;
    }
    try {
      await client.get("/students/me/teacher-review");
      navigate("/student/review");
    } catch (error: any) {
      const message =
        error?.response?.status === 404
          ? "老师还未对你做出评价哦，请耐心等待~"
          : (error?.response?.data?.detail ?? "暂时无法查看教师评价");
      toastInfo(message);
    }
  }, [dirtySurvey, dirtyNote, navigate, ensureSurveyComplete]);

  const goAi = useCallback(async () => {
    if (dirtySurvey || dirtyNote) {
      const ok = window.confirm(UNSAVED_PROMPT);

      if (!ok) {
        return;
      }
    }

    setCheckingAi(true);

    try {
      const surveyOk = await ensureSurveyComplete();

      if (!surveyOk) {
        return;
      }

      try {
        await client.get("/students/me/teacher-review");
      } catch (error: any) {
        if (error?.response?.status === 404) {
          toastInfo("老师还未对你做出评价哦，请耐心等待~");

          return;
        }

        throw error;
      }

      navigate("/student/ai");
    } catch (error) {
      toastError("暂时无法智能综评, 请稍后再试~");
    } finally {
      setCheckingAi(false);
    }
  }, [dirtySurvey, dirtyNote, navigate, UNSAVED_PROMPT, ensureSurveyComplete]);

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
      {ENABLE_SURVEY_AUTOFILL && (
        <Box>
          <Button
            variant="outlined"
            size="small"
            onClick={handleAutofill}
            disabled={isLocked}
          >
            一键填写（测试专用）
          </Button>
        </Box>
      )}
      <SurveyContent
        config={config}
        answers={answers}
        composite={composite}
        traitsList={traitsList}
        stages={stages}
        grade={grade}
        isFirstGrade={isFirstGrade}
        savingSurvey={savingSurvey}
        isLocked={isLocked}
        onUpdateAnswer={handleUpdateAnswer}
        onToggleTrait={handleTraitToggle}
        onCompositeRadio={handleCompositeRadio}
        onCompositeScore={handleCompositeScore}
        onSaveSurvey={saveSurvey}
      />

      <Card>
        <CardContent>
          <Typography variant="h6" fontWeight={600} mb={2}>
            👨‍👩‍👧‍👦家长评价（请围绕孩子的劳动表现展开）
          </Typography>
          <Stack spacing={2}>
            <TextField
              multiline
              minRows={6}
              fullWidth
              placeholder="对您的孩子说些什么吧，但也不要太多哦~ 300字以内就行啦~"
              value={parentNote}
              onChange={(event) => {
                if (guardLocked()) {
                  return;
                }
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
                disabled={savingNote || isLocked}
              >
                {savingNote ? "保存中..." : "保存家长评价"}
              </Button>
              <Button variant="outlined" onClick={goReview}>
                👩‍🏫查看老师对你的评价
              </Button>
              <Button variant="outlined" onClick={goAi} disabled={checkingAi}>
                {checkingAi
                  ? "检查中..."
                  : "🦋查看你的智能综评"}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
};

export default SurveyPage;
