"use client";

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Input,
  Progress,
  Textarea,
} from "@heroui/react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

type GradeItem = {
  id: string;
  name: string;
  score: string;
  max: string;
};

type GradeGroup = {
  id: string;
  name: string;
  weight: number;
  items: GradeItem[];
};

type Course = {
  id: string;
  name: string;
  credits: number;
  target: number;
  syllabusText: string;
  groups: GradeGroup[];
  showEditor: boolean;
  isCollapsed: boolean;
};

type IngestedComponent = {
  name: string;
  weight: number;
  items: string[];
};

const STORAGE_KEY = "gpa-planner-advanced-v1";

const gradeToGpa = (percent: number) => {
  if (percent >= 93) return 4;
  if (percent >= 90) return 3.7;
  if (percent >= 87) return 3.3;
  if (percent >= 83) return 3;
  if (percent >= 80) return 2.7;
  if (percent >= 77) return 2.3;
  if (percent >= 73) return 2;
  if (percent >= 70) return 1.7;
  if (percent >= 67) return 1.3;
  if (percent >= 65) return 1;
  return 0;
};

const toNum = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const toOptionalNum = (value: string) => {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const createItem = (name = "item") => ({
  id: crypto.randomUUID(),
  name,
  score: "",
  max: "100",
});

const createGroup = (name = "category", weight = 25): GradeGroup => ({
  id: crypto.randomUUID(),
  name,
  weight,
  items: [createItem("item 1")],
});

const createDefaultGroups = () => [
  createGroup("homework", 30),
  createGroup("exams", 40),
  createGroup("final", 30),
];

const createCourse = (): Course => ({
  id: crypto.randomUUID(),
  name: "",
  credits: 3,
  target: 90,
  syllabusText: "",
  groups: [],
  showEditor: false,
  isCollapsed: false,
});

const normalizeToGroups = (components: IngestedComponent[]) => {
  if (components.length === 0) {
    return [createGroup("homework", 40), createGroup("exams", 60)];
  }

  return components.map((component, idx) => ({
    id: crypto.randomUUID(),
    name: component.name?.trim() || `category ${idx + 1}`,
    weight: Number.isFinite(component.weight) ? component.weight : 0,
    items:
      component.items && component.items.length > 0
        ? component.items.map((itemName) => createItem(itemName || "item"))
        : [createItem("item 1")],
  }));
};

const parseSyllabusLocally = (syllabusText: string): IngestedComponent[] => {
  const matches = [...syllabusText.matchAll(/([A-Za-z][A-Za-z &/\-]{2,})\s*[:\-]?\s*(\d{1,3}(?:\.\d+)?)\s*%/g)];

  if (matches.length > 0) {
    return matches.map((match) => ({
      name: match[1].trim(),
      weight: Number(match[2]),
      items: ["item 1"],
    }));
  }

  return [
    { name: "homework", weight: 30, items: ["hw 1"] },
    { name: "quizzes", weight: 20, items: ["quiz 1"] },
    { name: "exams", weight: 30, items: ["midterm"] },
    { name: "final", weight: 20, items: ["final exam"] },
  ];
};

const courseStats = (course: Course) => {
  const weightsTotal = course.groups.reduce((sum, group) => sum + Math.max(group.weight, 0), 0);
  const targetFraction = clamp(course.target, 0, 100) / 100;

  let currentPercent = 0;
  let maxPercent = 0;
  let knownContribution = 0;
  let remainingContributionWeight = 0;

  course.groups.forEach((group) => {
    const normalizedWeight = weightsTotal > 0 ? Math.max(group.weight, 0) / weightsTotal : 0;
    const itemsWithMax = group.items
      .map((item) => ({ item, max: toNum(item.max), score: toOptionalNum(item.score) }))
      .filter(({ max }) => max > 0);

    if (itemsWithMax.length === 0 || normalizedWeight <= 0) return;

    const totalMax = itemsWithMax.reduce((sum, data) => sum + data.max, 0);

    let gradedMax = 0;
    let gradedEarned = 0;
    let bestPossibleEarned = 0;
    let remainingMax = 0;

    itemsWithMax.forEach(({ max, score }) => {
      if (score === null) {
        remainingMax += max;
        bestPossibleEarned += max;
      } else {
        const boundedScore = clamp(score, 0, max);
        gradedMax += max;
        gradedEarned += boundedScore;
        bestPossibleEarned += boundedScore;
      }
    });

    const groupCurrent = gradedMax > 0 ? gradedEarned / gradedMax : 0;
    const groupBest = totalMax > 0 ? bestPossibleEarned / totalMax : 0;

    currentPercent += groupCurrent * normalizedWeight * 100;
    maxPercent += groupBest * normalizedWeight * 100;

    knownContribution += (gradedEarned / totalMax) * normalizedWeight;
    remainingContributionWeight += (remainingMax / totalMax) * normalizedWeight;
  });

  const neededAverageOnRemaining =
    remainingContributionWeight > 0
      ? ((targetFraction - knownContribution) / remainingContributionWeight) * 100
      : targetFraction <= knownContribution
        ? 0
        : 101;

  return {
    currentPercent,
    maxPercent,
    neededAverageOnRemaining,
  };
};

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([createCourse()]);
  const [ingestingCourseId, setIngestingCourseId] = useState<string | null>(null);
  const [statusByCourse, setStatusByCourse] = useState<Record<string, string>>({});

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as Array<Partial<Course>>;
      if (!Array.isArray(parsed) || parsed.length === 0) return;

      const migrated = parsed.map((course) => {
        const groups = Array.isArray(course.groups) ? course.groups : [];
        const showEditor = typeof course.showEditor === "boolean" ? course.showEditor : groups.length > 0;
        const isCollapsed = typeof course.isCollapsed === "boolean" ? course.isCollapsed : false;

        return {
          ...createCourse(),
          ...course,
          groups,
          showEditor,
          isCollapsed,
        } as Course;
      });

      setCourses(migrated);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
  }, [courses]);

  const setCourse = (courseId: string, updater: (course: Course) => Course) => {
    setCourses((prev) => prev.map((course) => (course.id === courseId ? updater(course) : course)));
  };

  const addCourse = () => setCourses((prev) => [...prev, createCourse()]);

  const removeCourse = (courseId: string) => {
    setCourses((prev) => (prev.length > 1 ? prev.filter((course) => course.id !== courseId) : prev));
  };

  const toggleCourseCollapsed = (courseId: string) => {
    setCourse(courseId, (current) => ({ ...current, isCollapsed: !current.isCollapsed }));
  };

  const openManualSetup = (courseId: string) => {
    setCourse(courseId, (current) => ({
      ...current,
      groups: current.groups.length > 0 ? current.groups : createDefaultGroups(),
      showEditor: true,
      isCollapsed: false,
    }));
  };

  const ingestSyllabus = async (courseId: string) => {
    const course = courses.find((c) => c.id === courseId);
    if (!course || !course.syllabusText.trim()) {
      setStatusByCourse((prev) => ({ ...prev, [courseId]: "paste your syllabus first, then ingest." }));
      return;
    }

    setIngestingCourseId(courseId);
    setStatusByCourse((prev) => ({ ...prev, [courseId]: "reading your syllabus..." }));

    try {
      const response = await fetch("/api/ingest-syllabus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syllabus: course.syllabusText }),
      });

      if (!response.ok) {
        throw new Error("no-ai");
      }

      const data = (await response.json()) as { components: IngestedComponent[] };
      const nextGroups = normalizeToGroups(data.components || []);

      setCourse(courseId, (current) => ({ ...current, groups: nextGroups, showEditor: true, isCollapsed: false }));
      setStatusByCourse((prev) => ({ ...prev, [courseId]: "done. tweak anything that changed in class later." }));
    } catch {
      const fallback = normalizeToGroups(parseSyllabusLocally(course.syllabusText));
      setCourse(courseId, (current) => ({ ...current, groups: fallback, showEditor: true, isCollapsed: false }));
      setStatusByCourse((prev) => ({
        ...prev,
        [courseId]: "i used a local fallback parser. add a GEMINI_API_KEY later for stronger ai parsing.",
      }));
    } finally {
      setIngestingCourseId(null);
    }
  };

  const uploadSyllabusFile = async (courseId: string, file: File | null) => {
    if (!file) return;

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    if (isPdf) {
      setIngestingCourseId(courseId);
      setStatusByCourse((prev) => ({
        ...prev,
        [courseId]: "reading your pdf syllabus...",
      }));

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/ingest-syllabus-file", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("pdf-failed");
        }

        const data = (await response.json()) as { components: IngestedComponent[] };
        const nextGroups = normalizeToGroups(data.components || []);

        setCourse(courseId, (current) => ({ ...current, groups: nextGroups, showEditor: true, isCollapsed: false }));
        setStatusByCourse((prev) => ({
          ...prev,
          [courseId]: `parsed ${file.name}. categories are ready to tweak.`,
        }));
      } catch {
        setStatusByCourse((prev) => ({
          ...prev,
          [courseId]: "couldn't parse that pdf right now. try again, or paste the grading section text manually.",
        }));
      } finally {
        setIngestingCourseId(null);
      }

      return;
    }

    const canReadAsText =
      file.type.startsWith("text/") ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".md") ||
      file.name.endsWith(".csv");

    if (!canReadAsText) {
      setStatusByCourse((prev) => ({
        ...prev,
        [courseId]: "use a .pdf, .txt, .md, or .csv file, or paste the text directly.",
      }));
      return;
    }

    try {
      const text = await file.text();
      setCourse(courseId, (current) => ({ ...current, syllabusText: text }));
      setStatusByCourse((prev) => ({
        ...prev,
        [courseId]: `uploaded ${file.name}. now hit ingest syllabus.`,
      }));
    } catch {
      setStatusByCourse((prev) => ({
        ...prev,
        [courseId]: "couldn't read that file. try .pdf/.txt/.md/.csv or paste the text.",
      }));
    }
  };

  const totals = useMemo(() => {
    const totalCredits = courses.reduce((sum, course) => sum + Math.max(course.credits, 0), 0);

    const maxTermPoints = courses.reduce((sum, course) => {
      const stats = courseStats(course);
      return sum + gradeToGpa(stats.maxPercent) * Math.max(course.credits, 0);
    }, 0);

    return {
      totalCredits,
      maxTermGpa: totalCredits > 0 ? maxTermPoints / totalCredits : 0,
    };
  }, [courses]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_0%_0%,#fdf6e9_0%,#f6efe3_32%,#efe7d8_100%)] p-5 sm:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(120,80,30,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(120,80,30,0.06)_1px,transparent_1px)] bg-[size:28px_28px]" />
      <motion.div
        className="mx-auto flex w-full max-w-6xl flex-col gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <Card className="border border-amber-900/20 bg-white/80 shadow-[0_24px_80px_rgba(87,53,17,0.16)] backdrop-blur-sm">
          <CardHeader className="flex flex-col items-start gap-2">
            <p className="font-[family-name:var(--font-instrument-serif)] text-4xl font-semibold tracking-tight text-amber-950 sm:text-5xl">
              GradePilot
            </p>
            <p className="max-w-2xl font-[family-name:var(--font-bricolage)] text-amber-900/80">
              add classes once, keep them saved, and estimate your max GPA with weighted grade structures.
            </p>
          </CardHeader>
          <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <Chip color="primary" variant="flat">
                max term GPA: {totals.maxTermGpa.toFixed(2)}
              </Chip>
              <Chip color="success" variant="flat">
                total credits: {totals.totalCredits}
              </Chip>
              <Chip color="warning" variant="flat">
                autosave: on
              </Chip>
            </div>
            <Button color="primary" onPress={addCourse}>
              add class
            </Button>
          </CardBody>
        </Card>

        <div className="grid gap-4">
          {courses.map((course, classIndex) => {
            const stats = courseStats(course);
            const progressValue =
              course.target > 0 ? clamp((stats.currentPercent / course.target) * 100, 0, 100) : 0;

            return (
              <Card key={course.id} className="border border-amber-900/15 bg-white/85 shadow-[0_12px_36px_rgba(90,50,10,0.12)]">
                <CardBody className="grid gap-4">
                  <div className={`grid gap-3 ${course.showEditor && !course.isCollapsed ? "sm:grid-cols-4" : "sm:grid-cols-2"}`}>
                    <Input
                      label={`class ${classIndex + 1}`}
                      placeholder="ex: csc 120"
                      value={course.name}
                      onValueChange={(value) => setCourse(course.id, (current) => ({ ...current, name: value }))}
                    />

                    {course.showEditor && !course.isCollapsed ? (
                      <>
                        <Input
                          type="number"
                          label="credits"
                          value={String(course.credits)}
                          onValueChange={(value) =>
                            setCourse(course.id, (current) => ({ ...current, credits: toNum(value) }))
                          }
                        />
                        <Input
                          type="number"
                          label="target final %"
                          value={String(course.target)}
                          onValueChange={(value) =>
                            setCourse(course.id, (current) => ({ ...current, target: toNum(value) }))
                          }
                        />
                      </>
                    ) : null}

                    <div className="flex items-end justify-end gap-2">
                      <Button
                        variant="flat"
                        color="secondary"
                        isLoading={ingestingCourseId === course.id}
                        onPress={() => ingestSyllabus(course.id)}
                      >
                        ingest syllabus
                      </Button>
                      {!course.showEditor ? (
                        <Button variant="flat" onPress={() => openManualSetup(course.id)}>
                          set up manually
                        </Button>
                      ) : null}
                      <Button variant="flat" onPress={() => toggleCourseCollapsed(course.id)}>
                        {course.isCollapsed ? "expand" : "collapse"}
                      </Button>
                      <Button
                        variant="light"
                        color="danger"
                        onPress={() => removeCourse(course.id)}
                        isDisabled={courses.length === 1}
                      >
                        remove
                      </Button>
                    </div>
                  </div>

                  {course.isCollapsed ? (
                    <div className="flex flex-wrap gap-2">
                      <Chip color="default" variant="flat">
                        current: {stats.currentPercent.toFixed(1)}%
                      </Chip>
                      <Chip color="success" variant="flat">
                        max: {stats.maxPercent.toFixed(1)}%
                      </Chip>
                    </div>
                  ) : (
                    <div className="grid gap-4">
                      <Textarea
                        label={course.showEditor ? "syllabus text (optional)" : "paste syllabus text"}
                        placeholder="paste your syllabus grading section here"
                        value={course.syllabusText}
                        minRows={3}
                        onValueChange={(value) =>
                          setCourse(course.id, (current) => ({ ...current, syllabusText: value }))
                        }
                      />

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm text-amber-900/60">or upload syllabus file (.pdf, .txt, .md, .csv)</p>
                        <input
                          type="file"
                          accept=".pdf,.txt,.md,.csv,text/*,application/pdf"
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0] || null;
                            void uploadSyllabusFile(course.id, file);
                            event.currentTarget.value = "";
                          }}
                          className="block w-full max-w-xs text-sm text-amber-900/70 file:mr-3 file:rounded-xl file:border file:border-amber-900/30 file:bg-amber-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-amber-900 hover:file:bg-amber-200"
                        />
                      </div>

                      {statusByCourse[course.id] ? (
                        <p className="text-sm text-amber-900/75">{statusByCourse[course.id]}</p>
                      ) : null}

                      {course.showEditor ? (
                        <>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <Card className="bg-amber-50/80 shadow-none">
                              <CardBody className="gap-1">
                                <p className="text-sm text-amber-900/60">current weighted grade</p>
                                <p className="text-2xl font-semibold text-amber-950">{stats.currentPercent.toFixed(1)}%</p>
                              </CardBody>
                            </Card>
                            <Card className="bg-emerald-50 shadow-none">
                              <CardBody className="gap-1">
                                <p className="text-sm text-emerald-700">max final you can still hit</p>
                                <p className="text-2xl font-semibold text-emerald-800">{stats.maxPercent.toFixed(1)}%</p>
                              </CardBody>
                            </Card>
                            <Card className="bg-orange-50 shadow-none">
                              <CardBody className="gap-1">
                                <p className="text-sm text-orange-800">needed avg on remaining</p>
                                <p className="text-2xl font-semibold text-orange-900">
                                  {stats.neededAverageOnRemaining > 100
                                    ? "not possible"
                                    : `${stats.neededAverageOnRemaining.toFixed(1)}%`}
                                </p>
                              </CardBody>
                            </Card>
                          </div>

                          <Progress aria-label="target progress" value={progressValue} color="primary" />
                          <Divider />

                          <div className="grid gap-3">
                            {course.groups.map((group, groupIndex) => (
                              <Card key={group.id} className="border border-amber-900/20 bg-amber-50/70 shadow-none">
                                <CardBody className="grid gap-3">
                                  <div className="grid gap-2 sm:grid-cols-12">
                                    <Input
                                      className="sm:col-span-6"
                                      label={`category ${groupIndex + 1}`}
                                      value={group.name}
                                      onValueChange={(value) =>
                                        setCourse(course.id, (current) => ({
                                          ...current,
                                          groups: current.groups.map((currentGroup) =>
                                            currentGroup.id === group.id ? { ...currentGroup, name: value } : currentGroup,
                                          ),
                                        }))
                                      }
                                    />
                                    <Input
                                      className="sm:col-span-3"
                                      type="number"
                                      label="weight %"
                                      value={String(group.weight)}
                                      onValueChange={(value) =>
                                        setCourse(course.id, (current) => ({
                                          ...current,
                                          groups: current.groups.map((currentGroup) =>
                                            currentGroup.id === group.id ? { ...currentGroup, weight: toNum(value) } : currentGroup,
                                          ),
                                        }))
                                      }
                                    />
                                    <div className="sm:col-span-3 flex items-end justify-end">
                                      <Button
                                        variant="light"
                                        color="danger"
                                        isDisabled={course.groups.length === 1}
                                        onPress={() =>
                                          setCourse(course.id, (current) => ({
                                            ...current,
                                            groups:
                                              current.groups.length > 1
                                                ? current.groups.filter((currentGroup) => currentGroup.id !== group.id)
                                                : current.groups,
                                          }))
                                        }
                                      >
                                        remove category
                                      </Button>
                                    </div>
                                  </div>

                                  <div className="grid gap-2">
                                    {group.items.map((item) => (
                                      <div key={item.id} className="grid gap-2 sm:grid-cols-12">
                                        <Input
                                          className="sm:col-span-5"
                                          label="item"
                                          value={item.name}
                                          onValueChange={(value) =>
                                            setCourse(course.id, (current) => ({
                                              ...current,
                                              groups: current.groups.map((currentGroup) =>
                                                currentGroup.id === group.id
                                                  ? {
                                                      ...currentGroup,
                                                      items: currentGroup.items.map((currentItem) =>
                                                        currentItem.id === item.id ? { ...currentItem, name: value } : currentItem,
                                                      ),
                                                    }
                                                  : currentGroup,
                                              ),
                                            }))
                                          }
                                        />
                                        <Input
                                          className="sm:col-span-3"
                                          type="number"
                                          label="score"
                                          placeholder="blank = not graded"
                                          value={item.score}
                                          onValueChange={(value) =>
                                            setCourse(course.id, (current) => ({
                                              ...current,
                                              groups: current.groups.map((currentGroup) =>
                                                currentGroup.id === group.id
                                                  ? {
                                                      ...currentGroup,
                                                      items: currentGroup.items.map((currentItem) =>
                                                        currentItem.id === item.id ? { ...currentItem, score: value } : currentItem,
                                                      ),
                                                    }
                                                  : currentGroup,
                                              ),
                                            }))
                                          }
                                        />
                                        <Input
                                          className="sm:col-span-3"
                                          type="number"
                                          label="out of"
                                          value={item.max}
                                          onValueChange={(value) =>
                                            setCourse(course.id, (current) => ({
                                              ...current,
                                              groups: current.groups.map((currentGroup) =>
                                                currentGroup.id === group.id
                                                  ? {
                                                      ...currentGroup,
                                                      items: currentGroup.items.map((currentItem) =>
                                                        currentItem.id === item.id ? { ...currentItem, max: value } : currentItem,
                                                      ),
                                                    }
                                                  : currentGroup,
                                              ),
                                            }))
                                          }
                                        />
                                        <div className="sm:col-span-1 flex items-end justify-end">
                                          <Button
                                            variant="light"
                                            color="danger"
                                            isDisabled={group.items.length === 1}
                                            onPress={() =>
                                              setCourse(course.id, (current) => ({
                                                ...current,
                                                groups: current.groups.map((currentGroup) =>
                                                  currentGroup.id === group.id
                                                    ? {
                                                        ...currentGroup,
                                                        items:
                                                          currentGroup.items.length > 1
                                                            ? currentGroup.items.filter((currentItem) => currentItem.id !== item.id)
                                                            : currentGroup.items,
                                                      }
                                                    : currentGroup,
                                                ),
                                              }))
                                            }
                                          >
                                            x
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>

                                  <div className="flex justify-end">
                                    <Button
                                      variant="flat"
                                      onPress={() =>
                                        setCourse(course.id, (current) => ({
                                          ...current,
                                          groups: current.groups.map((currentGroup) =>
                                            currentGroup.id === group.id
                                              ? {
                                                  ...currentGroup,
                                                  items: [...currentGroup.items, createItem(`item ${currentGroup.items.length + 1}`)],
                                                }
                                              : currentGroup,
                                          ),
                                        }))
                                      }
                                    >
                                      add item
                                    </Button>
                                  </div>
                                </CardBody>
                              </Card>
                            ))}
                          </div>

                          <div className="flex justify-end">
                            <Button
                              variant="flat"
                              color="primary"
                              onPress={() =>
                                setCourse(course.id, (current) => ({
                                  ...current,
                                  groups: [...current.groups, createGroup(`category ${current.groups.length + 1}`, 10)],
                                }))
                              }
                            >
                              add category
                            </Button>
                          </div>
                        </>
                      ) : (
                        <Card className="bg-amber-50/80 shadow-none">
                          <CardBody className="gap-2">
                            <p className="text-sm text-amber-900/80">
                              start simple: upload a syllabus first, then hit ingest syllabus and we will build the full
                              grade structure for you.
                            </p>
                            <div className="flex justify-end">
                              <Button variant="light" onPress={() => openManualSetup(course.id)}>
                                no syllabus? set up manually
                              </Button>
                            </div>
                          </CardBody>
                        </Card>
                      )}
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}














