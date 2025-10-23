import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Container,
  Divider,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  TextField,
  Button,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import client from "../../api/client";
import { toastError } from "../../components/toast";

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
    student_no: string | null;
    class_no: string | null;
    grade: number | null;
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
  teacher_review:
    | {
        selected_traits: string[];
        rendered_text: string;
        submitted_at: string;
        updated_at: string;
      }
    | null;
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

type AdminSurveyContentProps = {
  config: SurveyConfig;
  answers: Record<number, SurveyItemAnswer>;
  composite: {
    q1: Record<string, string>;
    q2: Record<string, string>;
    q3: Record<string, Record<string, number>>;
  };
  traitsList: string[];
  stages: string[];
  metrics: string[];
  studentGrade: number | null | undefined;
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

const AdminSurveyContent = ({
  config,
  answers,
  composite,
  traitsList,
  stages,
  metrics,
  studentGrade,
}: AdminSurveyContentProps) => {
  const isFirstGrade = studentGrade === 1;

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
            ? (majorTotals.get(majorKey) ?? section.items.length)
            : 0,
          minorRowSpan: index === 0 ? section.items.length : 0,
        });
      });
    });
    return rows;
  }, [config.sections, majorTotals]);

  const gradeKey =
    studentGrade != null ? String(studentGrade) : ("default" as const);

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
                {structuredRows.map((row) => {
                  const currentValue = answers[row.item.id] ?? EMPTY_ANSWER;
                  return (
                    <TableRow key={row.item.id} sx={{ "& td": { py: 1.5 } }}>
                      {row.showMajor ? (
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
                          <Typography sx={verticalCategoryTextSx}>
                            {row.major}
                          </Typography>
                        </TableCell>
                      ) : null}
                      {row.showMinor ? (
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
                          <Typography sx={verticalSubCategoryTextSx}>
                            {row.minor}
                          </Typography>
                        </TableCell>
                      ) : null}
                      <TableCell
                        sx={{
                          ...columnBorderSx,
                          verticalAlign: "middle",
                          textAlign: "center",
                          minWidth: 140,
                          px: 2,
                        }}
                      >
                        <Typography sx={projectTextSx}>
                          {row.item.prompt}
                        </Typography>
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
                          sx={{
                            flexWrap: "nowrap",
                            columnGap: 2,
                            justifyContent: "center",
                            pointerEvents: "none",
                          }}
                        >
                          {surveyFrequencyOptions.map((option) => (
                            <FormControlLabel
                              key={option}
                              value={option}
                              control={
                                <Radio size="small" sx={{ p: 0.5 }} />
                              }
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
                          sx={{
                            flexWrap: "nowrap",
                            columnGap: 2,
                            justifyContent: "center",
                            pointerEvents: "none",
                          }}
                        >
                          {skillOptions.map((option) => (
                            <FormControlLabel
                              key={option}
                              value={option}
                              control={
                                <Radio size="small" sx={{ p: 0.5 }} />
                              }
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
                                onClick={(event) => event.preventDefault()}
                                control={
                                  <Checkbox
                                    size="small"
                                    sx={{ p: 0.5, pointerEvents: "none" }}
                                    checked={currentValue.traits.includes(trait)}
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
                })}
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
                    sx={{ pointerEvents: "none" }}
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
                    sx={{ pointerEvents: "none" }}
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
                2、在劳动中，你的习惯养成情况是？
              </Typography>
              <Stack spacing={1}>
                <Box display="flex" alignItems="center">
                  <Typography color="text.secondary" sx={{ mr: 1 }}>
                    原来：
                  </Typography>
                  <RadioGroup
                    row
                    value={composite.q2.原来 ?? ""}
                    sx={{ pointerEvents: "none" }}
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
                    sx={{ pointerEvents: "none" }}
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
                            <TableCell
                              key={metric}
                              sx={{ fontSize: "1rem", whiteSpace: "nowrap" }}
                            >
                              {metric}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {stages.map((stage) => {
                          const hintMap =
                            compositeStageHints[gradeKey] ??
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
                                    size="small"
                                    value={composite.q3[stage]?.[metric] ?? ""}
                                    inputProps={{
                                      readOnly: true,
                                      min: 0,
                                      max: 100,
                                    }}
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
};

const EMPTY_COMPOSITE = {
  q1: { 原来: "", 现在: "" },
  q2: { 原来: "", 现在: "" },
  q3: {} as Record<string, Record<string, number>>,
};

const AdminStudentPage = () => {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<TeacherStudentDetail | null>(null);
  const [config, setConfig] = useState<SurveyConfig | null>(null);
  const [answers, setAnswers] = useState<Record<number, SurveyItemAnswer>>({});
  const [composite, setComposite] = useState(EMPTY_COMPOSITE);
  const [loading, setLoading] = useState(true);
  const [llmLoading, setLlmLoading] = useState(true);
  const [llmContent, setLlmContent] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!studentId) {
        return;
      }
      try {
        setLoading(true);
        const { data } = await client.get<TeacherStudentDetail>(
          `/teacher/students/${studentId}`,
        );
        const band = data.student.grade_band ?? "low";
        const { data: conf } = await client.get<SurveyConfig>(
          `/config/survey?grade_band=${band}`,
        );

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
      } catch (error) {
        toastError("加载学生信息失败，请稍后再试~");
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [studentId]);

  useEffect(() => {
    const fetchLlm = async () => {
      if (!studentId) {
        return;
      }
      try {
        setLlmLoading(true);
        const { data } = await client.get<{ content: string }>(
          `/teacher/students/${studentId}/llm-eval`,
          { skipErrorToast: true } as any,
        );
        setLlmContent(data.content ?? "");
      } catch {
        setLlmContent(null);
      } finally {
        setLlmLoading(false);
      }
    };
    fetchLlm();
  }, [studentId]);

  const traitsList = config?.traits ?? [];
  const stages = useMemo(() => {
    const question = config?.composite_questions.find(
      (item) => item.key === "q3",
    );
    if (!question?.rows_by_grade) {
      return [];
    }
    const grade = detail?.student.grade;
    return question.rows_by_grade[String(grade ?? "")] ?? [];
  }, [config?.composite_questions, detail?.student.grade]);

  const metrics = useMemo(() => {
    const question = config?.composite_questions.find(
      (item) => item.key === "q3",
    );
    const cols = question?.columns ?? [];
    return cols.length > 0 ? cols : DEFAULT_METRIC_LABELS;
  }, [config?.composite_questions]);

  if (loading || !detail || !config) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          backgroundColor: "#f0f9ff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <CircularProgress color="primary" />
        <Typography mt={2} color="text.secondary">
          正在加载，请稍候...
        </Typography>
      </Box>
    );
  }

  const teacherReview = detail.teacher_review;
  const hasTeacherReview =
    teacherReview && teacherReview.rendered_text?.trim().length > 0;

  return (
    <Box
      sx={{
        minHeight: "100vh",
        backgroundColor: "#f0f9ff",
        py: { xs: 4, md: 6 },
      }}
    >
      <Container maxWidth="lg">
        <Stack spacing={3}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            alignItems={{ xs: "flex-start", md: "center" }}
            justifyContent="space-between"
            spacing={2}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Typography color="primary" sx={{ fontSize: "1.5rem" }}>
                🦋
              </Typography>
              <Typography variant="h6" color="primary" fontWeight={700}>
                南湖“小彩蝶”劳动益“美”行——蝶宝劳动成长评价
              </Typography>
            </Stack>
            <Button variant="outlined" onClick={() => navigate("/admin")}>
              ↩️返回查看信息汇总
            </Button>
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="h5" fontWeight={700}>
              {detail.student.student_name}
            </Typography>
          </Stack>

          <AdminSurveyContent
            config={config}
            answers={answers}
            composite={composite}
            traitsList={traitsList}
            stages={stages}
            metrics={metrics}
            studentGrade={detail.student.grade}
          />

          <Card
            sx={{
              borderRadius: 3,
              boxShadow: "0 16px 32px rgba(255, 138, 128, 0.12)",
              background: "#ffffff",
            }}
          >
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={2}>
                👨‍👩‍👧‍👦家长评价（请围绕孩子的劳动表现展开）
              </Typography>
              <Typography
                sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}
                color={
                  detail.parent_note?.content?.trim() ? "text.primary" : "text.secondary"
                }
              >
                {detail.parent_note?.content?.trim() || "暂无家长评价~"}
              </Typography>
            </CardContent>
          </Card>

          <Card
            sx={{
              borderRadius: 3,
              boxShadow: "0 16px 32px rgba(255, 138, 128, 0.12)",
              background: "#ffffff",
            }}
          >
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={2}>
                👩‍🏫教师评价
              </Typography>
              {hasTeacherReview ? (
                <Stack spacing={2}>
                  <Typography
                    sx={{
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.8,
                      paddingLeft: "0.5em",
                      textIndent: "-0.5em",
                    }}
                  >
                    {teacherReview.rendered_text}
                  </Typography>
                </Stack>
              ) : (
                <Typography color="text.secondary">暂无教师评价~</Typography>
              )}
            </CardContent>
          </Card>

          <Card
            sx={{
              borderRadius: 3,
              boxShadow: "0 16px 32px rgba(255, 138, 128, 0.12)",
              background: "#ffffff",
            }}
          >
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={2}>
                🦋智能综评
              </Typography>
              {llmLoading ? (
                <Stack alignItems="center" spacing={2}>
                  <CircularProgress color="secondary" size={28} />
                  <Typography color="text.secondary">正在加载智能评语...</Typography>
                </Stack>
              ) : llmContent ? (
                <Typography sx={{ whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
                  {llmContent}
                </Typography>
              ) : (
                <Typography color="text.secondary">暂无智能综评~</Typography>
              )}
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
};

export default AdminStudentPage;
