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
  Tab,
  Tabs,
  TextField,
  Typography,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import client from "../../api/client";
import { useAuthStore } from "../../store/auth";
import { toastError, toastSuccess } from "../../components/toast";

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

const frequencyOptions = ["每天", "经常", "偶尔"];
const skillOptions = ["熟练", "一般", "不会"];
const habitOptions = ["完全同意", "比较同意", "部分同意", "不同意"];

const SurveyPage = () => {
  const navigate = useNavigate();
  const auth = useAuthStore();
  const [tab, setTab] = useState(0);
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
  const [dirtySurvey, setDirtySurvey] = useState(false);
  const [dirtyNote, setDirtyNote] = useState(false);

  const stages = useMemo(() => {
    const grade = auth.user?.grade ?? 1;
    const question = config?.composite_questions.find((item) => item.key === "q3");
    if (!question?.rows_by_grade) {
      return [];
    }
    return question.rows_by_grade[String(grade)] ?? [];
  }, [auth.user?.grade, config]);

  useEffect(() => {
    const load = async () => {
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
        }
        if (comp) {
          setComposite({
            q1: comp.q1 ?? { 原来: "", 现在: "" },
            q2: comp.q2 ?? { 原来: "", 现在: "" },
            q3: comp.q3 ?? {},
          });
        }
        if (note?.content !== undefined) {
          setParentNote(note.content);
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [auth.user?.grade_band]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirtySurvey || dirtyNote) {
        event.preventDefault();
        // eslint-disable-next-line no-param-reassign
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirtySurvey, dirtyNote]);

  const traitsList = config?.traits ?? [];

  const updateAnswer = (
    itemId: number,
    partial: Partial<SurveyItemAnswer>,
  ) => {
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
    setDirtySurvey(true);
  };

  const handleTraitToggle = (itemId: number, trait: string) => {
    setAnswers((prev) => {
      const existing = prev[itemId] ?? { frequency: "", skill: "", traits: [] };
      let traits = existing.traits ?? [];
      if (traits.includes(trait)) {
        traits = traits.filter((t) => t !== trait);
      } else {
        if (traits.length >= 3) {
          toastError("品格养成最多选择3项哦~");
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
  };

  const handleCompositeRadio = (
    question: "q1" | "q2",
    key: string,
    value: string,
  ) => {
    setComposite((prev) => ({
      ...prev,
      [question]: { ...prev[question], [key]: value },
    }));
    setDirtySurvey(true);
  };

  const handleCompositeScore = (stage: string, metric: string, raw: string) => {
    setComposite((prev) => {
      const numeric = raw === "" ? undefined : Number(raw);
      if (numeric !== undefined && Number.isNaN(numeric)) {
        return prev;
      }
      const stageValues = { ...(prev.q3[stage] ?? {}) };
      if (numeric === undefined) {
        delete stageValues[metric];
      } else {
        stageValues[metric] = numeric;
      }
      const nextStage = { ...prev.q3 };
      if (Object.keys(stageValues).length === 0) {
        delete nextStage[stage];
      } else {
        nextStage[stage] = stageValues;
      }
      return {
        ...prev,
        q3: nextStage,
      };
    });
    setDirtySurvey(true);
  };

  const saveSurvey = async () => {
    setSavingSurvey(true);
    try {
      const payload = Object.entries(answers)
        .filter(([_id, value]) => value.frequency && value.skill)
        .map(([id, value]) => ({
          survey_item_id: Number(id),
          frequency: value.frequency,
          skill: value.skill,
          traits: value.traits,
        }));
      await client.put("/students/me/survey", {
        items: payload,
      });
      await client.put("/students/me/composite", composite);
      toastSuccess("保存成功");
      setDirtySurvey(false);
    } finally {
      setSavingSurvey(false);
    }
  };

  const saveParentNote = async () => {
    if (parentNote.length > 300) {
      toastError("家长寄语需300字以内");
      return;
    }
    setSavingNote(true);
    try {
      await client.put("/students/me/parent-note", {
        content: parentNote,
      });
      toastSuccess("家长寄语已保存");
      setDirtyNote(false);
    } finally {
      setSavingNote(false);
    }
  };

  const goReview = () => {
    if (dirtySurvey || dirtyNote) {
      const ok = window.confirm("是否保存更改？未保存的内容将会丢失！");
      if (!ok) {
        return;
      }
    }
    navigate("/student/review");
  };

  const goAi = () => {
    if (dirtySurvey || dirtyNote) {
      const ok = window.confirm("是否保存更改？未保存的内容将会丢失！");
      if (!ok) {
        return;
      }
    }
    navigate("/student/ai");
  };

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
      <Tabs
        value={tab}
        onChange={(_event, value) => setTab(value)}
        textColor="primary"
        indicatorColor="primary"
      >
        <Tab label="学生自评问卷" />
        <Tab label="家长寄语­" />
      </Tabs>
      {tab === 0 && (
        <Stack spacing={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={2}>
                劳动项目自我评价
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width="20%">劳动项目</TableCell>
                    <TableCell width="20%">参与情况</TableCell>
                    <TableCell width="20%">技能掌握</TableCell>
                    <TableCell>品格养成（最多选择3项）</TableCell>
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
                        <TableRow key={item.id} sx={{ verticalAlign: "top" }}>
                          <TableCell>
                            <Typography fontWeight={600}>
                              {section.major_category}
                            </Typography>
                            <Typography color="text.secondary">
                              {section.minor_category}
                            </Typography>
                            <Typography mt={1}>{item.prompt}</Typography>
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
                                updateAnswer(item.id, { skill: event.target.value })
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
                              {traitsList.map((trait) => (
                                <Grid item xs={4} key={trait}>
                                  <FormControlLabel
                                    control={
                                      <Checkbox
                                        checked={value.traits.includes(trait)}
                                        onChange={() =>
                                          handleTraitToggle(item.id, trait)
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
                    经过这次劳动计划，你的总体劳动参与率有没有变化？                  </Typography>
                  <Grid container spacing={2}>
                    {["原来", "现在"].map((phase) => (
                      <Grid item xs={12} md={6} key={phase}>
                        <Typography color="text.secondary">{phase}</Typography>
                        <RadioGroup
                          row
                          value={composite.q1[phase] ?? ""}
                          onChange={(event) =>
                            handleCompositeRadio("q1", phase, event.target.value)
                          }
                        >
                          {["每天", "经常", "偶尔", "从不"].map((option) => (
                            <FormControlLabel
                              key={option}
                              value={option}
                              control={<Radio />}
                              label={option}
                            />
                          ))}
                        </RadioGroup>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
                <Divider />
                <Box>
                  <Typography fontWeight={600} mb={1}>
                    经过这次劳动计划，你已经养成了积极参与劳动的习惯。                  </Typography>
                  <Grid container spacing={2}>
                    {["原来", "现在"].map((phase) => (
                      <Grid item xs={12} md={6} key={phase}>
                        <Typography color="text.secondary">{phase}</Typography>
                        <RadioGroup
                          row
                          value={composite.q2[phase] ?? ""}
                          onChange={(event) =>
                            handleCompositeRadio("q2", phase, event.target.value)
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
                      </Grid>
                    ))}
                  </Grid>
                </Box>
                <Divider />
                <Box>
                  <Typography fontWeight={600} mb={1}>
                    请为你在这次劳动计划中表现出的品质打个分吧（0-100）！
                  </Typography>
                  {stages.length === 0 ? (
                    <Typography color="text.secondary">
                      当前年级无需填写此项~                  </Typography>
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
                                  onChange={(
                                    event: ChangeEvent<HTMLInputElement>,
                                  ) =>
                                    handleCompositeScore(
                                      stage,
                                      metric,
                                      event.target.value,
                                    )}
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </Box>
              </Stack>
            </CardContent>
          </Card>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Button
              variant="contained"
              color="primary"
              onClick={saveSurvey}
              disabled={savingSurvey}
            >
              {savingSurvey ? "保存中..." : "保存并提交"}
            </Button>
            <Button variant="outlined" onClick={goReview}>
              查看老师对你的评语            </Button>
            <Button variant="outlined" onClick={goAi}>
              查看彩小蝶对你的综合评语
            </Button>
          </Stack>
        </Stack>
      )}
      {tab === 1 && (
        <Stack spacing={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} mb={2}>
                家长寄语（≤300字）
              </Typography>
              <TextField
                multiline
                minRows={6}
                fullWidth
                value={parentNote}
                onChange={(event) => {
                  setParentNote(event.target.value);
                  setDirtyNote(true);
                }}
                helperText={`${parentNote.length}/300`}
              />
            </CardContent>
          </Card>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Button
              variant="contained"
              color="primary"
              onClick={saveParentNote}
              disabled={savingNote}
            >
              {savingNote ? "保存中..." : "保存并提交"}
            </Button>
            <Button variant="outlined" onClick={goReview}>
              查看老师对你的评语             </Button>
            <Button variant="outlined" onClick={goAi}>
              查看彩小蝶对你的综合评语
            </Button>
          </Stack>
        </Stack>
      )}
    </Stack>
  );
};

export default SurveyPage;
