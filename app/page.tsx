"use client";

import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Progress,
  Switch,
  Textarea,
} from "@heroui/react";
import { useTheme } from "@/components/ThemeProvider";
import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

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
  dropLowest: number;
  isItemsCollapsed: boolean;
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

type Semester = {
  id: string;
  name: string;
  courses: Course[];
  isCollapsed: boolean;
};

type IngestedComponent = {
  name: string;
  weight: number;
  dropLowest: number;
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
  dropLowest: 0,
  isItemsCollapsed: false,
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

const createSemester = (name = "semester 1", courses: Course[] = [createCourse()]): Semester => ({
  id: crypto.randomUUID(),
  name,
  courses,
  isCollapsed: false,
});

const parseAndMigrateImport = (raw: string | null): Semester[] | null => {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const migrateCourse = (course: Partial<Course>): Course => {
      const groups = Array.isArray(course.groups)
        ? course.groups.map((group) => ({
            ...group,
            isItemsCollapsed: typeof group?.isItemsCollapsed === "boolean" ? group.isItemsCollapsed : false,
          }))
        : [];
      const showEditor = typeof course.showEditor === "boolean" ? course.showEditor : groups.length > 0;
      const isCollapsed = typeof course.isCollapsed === "boolean" ? course.isCollapsed : false;
      return { ...createCourse(), ...course, groups, showEditor, isCollapsed } as Course;
    };
    if (Array.isArray(parsed)) {
      if (parsed.length === 0) return null;
      const migratedCourses = parsed.map((course) => migrateCourse(course as Partial<Course>));
      return [createSemester("semester 1", migratedCourses)];
    }
    if (parsed && typeof parsed === "object" && "semesters" in parsed) {
      const semestersRaw = (parsed as { semesters?: Array<Partial<Semester>> }).semesters;
      if (!Array.isArray(semestersRaw) || semestersRaw.length === 0) return null;
      return semestersRaw.map((semester, idx) => {
        const coursesRaw = Array.isArray(semester.courses) ? semester.courses : [];
        const courses = coursesRaw.map((course) => migrateCourse(course as Partial<Course>));
        const name = typeof semester.name === "string" && semester.name.trim() ? semester.name : `semester ${idx + 1}`;
        const isCollapsed = typeof semester.isCollapsed === "boolean" ? semester.isCollapsed : false;
        return { ...createSemester(name, courses.length > 0 ? courses : [createCourse()]), ...semester, name, isCollapsed, courses } as Semester;
      });
    }
    return null;
  } catch {
    return null;
  }
};

const normalizeToGroups = (components: IngestedComponent[]) => {
  if (components.length === 0) {
    return [createGroup("homework", 40), createGroup("exams", 60)];
  }

  return components.map((component, idx) => ({
    id: crypto.randomUUID(),
    name: component.name?.trim() || `category ${idx + 1}`,
    weight: Number.isFinite(component.weight) ? component.weight : 0,
    dropLowest: Number.isFinite(component.dropLowest) ? Math.max(0, Math.floor(component.dropLowest)) : 0,
    isItemsCollapsed: false,
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
      dropLowest: 0,
      items: ["item 1"],
    }));
  }

  return [
    { name: "homework", weight: 30, dropLowest: 1, items: ["hw 1"] },
    { name: "quizzes", weight: 20, dropLowest: 0, items: ["quiz 1"] },
    { name: "exams", weight: 30, dropLowest: 0, items: ["midterm"] },
    { name: "final", weight: 20, dropLowest: 0, items: ["final exam"] },
  ];
};

const courseStats = (course: Course) => {
  const weightsTotal = course.groups.reduce((sum, group) => sum + Math.max(group.weight, 0), 0);
  const targetPercent = clamp(course.target, 0, 100);

  const applyDrops = (
    records: Array<{ earned: number; max: number }>,
    dropLowest: number,
  ): { earned: number; max: number } => {
    if (records.length === 0) return { earned: 0, max: 0 };

    const drops = Math.min(Math.max(Math.floor(dropLowest), 0), Math.max(records.length - 1, 0));
    const sorted = [...records].sort((a, b) => a.earned / a.max - b.earned / b.max);
    const kept = sorted.slice(drops);

    return {
      earned: kept.reduce((sum, item) => sum + item.earned, 0),
      max: kept.reduce((sum, item) => sum + item.max, 0),
    };
  };

  let currentPercent = 0;
  let maxPercent = 0;

  course.groups.forEach((group) => {
    const normalizedWeight = weightsTotal > 0 ? Math.max(group.weight, 0) / weightsTotal : 0;
    if (normalizedWeight <= 0) return;

    const gradedRecords = group.items
      .map((item) => ({ max: toNum(item.max), score: toOptionalNum(item.score) }))
      .filter((item) => item.max > 0 && item.score !== null)
      .map((item) => ({ earned: clamp(item.score as number, 0, item.max), max: item.max }));

    const bestRecords = group.items
      .map((item) => ({ max: toNum(item.max), score: toOptionalNum(item.score) }))
      .filter((item) => item.max > 0)
      .map((item) => ({
        earned: item.score === null ? item.max : clamp(item.score, 0, item.max),
        max: item.max,
      }));

    const currentAfterDrops = applyDrops(gradedRecords, group.dropLowest);
    const bestAfterDrops = applyDrops(bestRecords, group.dropLowest);

    const groupCurrent = currentAfterDrops.max > 0 ? currentAfterDrops.earned / currentAfterDrops.max : 0;
    const groupBest = bestAfterDrops.max > 0 ? bestAfterDrops.earned / bestAfterDrops.max : 0;

    currentPercent += groupCurrent * normalizedWeight * 100;
    maxPercent += groupBest * normalizedWeight * 100;
  });

  const neededAverageOnRemaining =
    maxPercent <= currentPercent + 0.001
      ? targetPercent <= currentPercent
        ? 0
        : 101
      : clamp(((targetPercent - currentPercent) / (maxPercent - currentPercent)) * 100, 0, 101);

  return {
    currentPercent,
    maxPercent,
    neededAverageOnRemaining,
  };
};

export default function Home() {
  const [semesters, setSemesters] = useState<Semester[]>([createSemester()]);
  const [ingestingCourseId, setIngestingCourseId] = useState<string | null>(null);
  const [statusByCourse, setStatusByCourse] = useState<Record<string, string>>({});
  const [syllabusModalCourseId, setSyllabusModalCourseId] = useState<string | null>(null);
  const [syllabusDraftText, setSyllabusDraftText] = useState("");
  const [draggedItem, setDraggedItem] = useState<{ courseId: string; groupId: string; itemId: string } | null>(null);
  const [dragOverItem, setDragOverItem] = useState<{ courseId: string; groupId: string; itemId: string } | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const migrated = parseAndMigrateImport(raw);
    if (migrated) setSemesters(migrated);
    else if (raw) localStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ semesters, version: 2 }));
  }, [semesters]);

  const setSemester = (semesterId: string, updater: (semester: Semester) => Semester) => {
    setSemesters((prev) => prev.map((semester) => (semester.id === semesterId ? updater(semester) : semester)));
  };

  const setCourse = (semesterId: string, courseId: string, updater: (course: Course) => Course) => {
    setSemester(semesterId, (semester) => ({
      ...semester,
      courses: semester.courses.map((course) => (course.id === courseId ? updater(course) : course)),
    }));
  };

  const addSemester = () => {
    setSemesters((prev) => [...prev, createSemester(`semester ${prev.length + 1}`)]);
  };

  const removeSemester = (semesterId: string) => {
    setSemesters((prev) => (prev.length > 1 ? prev.filter((semester) => semester.id !== semesterId) : prev));
  };

  const toggleSemesterCollapsed = (semesterId: string) => {
    setSemester(semesterId, (current) => ({ ...current, isCollapsed: !current.isCollapsed }));
  };

  const addCourse = (semesterId: string) => {
    setSemester(semesterId, (current) => ({ ...current, courses: [...current.courses, createCourse()], isCollapsed: false }));
  };

  const removeCourse = (semesterId: string, courseId: string) => {
    setSemester(semesterId, (current) => ({
      ...current,
      courses: current.courses.length > 1 ? current.courses.filter((course) => course.id !== courseId) : current.courses,
    }));
  };

  const toggleCourseCollapsed = (semesterId: string, courseId: string) => {
    setCourse(semesterId, courseId, (current) => ({ ...current, isCollapsed: !current.isCollapsed }));
  };

  const openManualSetup = (semesterId: string, courseId: string) => {
    setCourse(semesterId, courseId, (current) => ({
      ...current,
      groups: current.groups.length > 0 ? current.groups : createDefaultGroups(),
      showEditor: true,
      isCollapsed: false,
    }));
  };

  const findCourse = (courseId: string) => {
    for (const semester of semesters) {
      const course = semester.courses.find((c) => c.id === courseId);
      if (course) return { semesterId: semester.id, course };
    }
    return null;
  };

  const ingestSyllabus = async (courseId: string, syllabusOverride?: string) => {
    const found = findCourse(courseId);
    const syllabusSource = syllabusOverride ?? found?.course?.syllabusText ?? "";

    if (!found?.course || !syllabusSource.trim()) {
      setStatusByCourse((prev) => ({ ...prev, [courseId]: "paste your syllabus first, then ingest." }));
      return;
    }

    setIngestingCourseId(courseId);
    setStatusByCourse((prev) => ({ ...prev, [courseId]: "reading your syllabus..." }));

    try {
      const response = await fetch("/api/ingest-syllabus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syllabus: syllabusSource }),
      });

      if (!response.ok) {
        throw new Error("no-ai");
      }

      const data = (await response.json()) as { courseName?: string; components: IngestedComponent[] };
      const nextGroups = normalizeToGroups(data.components || []);
      const courseName = (data.courseName ?? "").trim();

      setCourse(found.semesterId, courseId, (current) => ({
        ...current,
        name: courseName || current.name,
        groups: nextGroups,
        showEditor: true,
        isCollapsed: false,
      }));
      setStatusByCourse((prev) => ({ ...prev, [courseId]: "done. tweak anything that changed in class later." }));
    } catch {
      const fallback = normalizeToGroups(parseSyllabusLocally(syllabusSource));
      setCourse(found.semesterId, courseId, (current) => ({ ...current, groups: fallback, showEditor: true, isCollapsed: false }));
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

        const data = (await response.json()) as { courseName?: string; components: IngestedComponent[] };
        const nextGroups = normalizeToGroups(data.components || []);
        const courseName = (data.courseName ?? "").trim();

        const found = findCourse(courseId);
        if (!found) throw new Error("missing-course");
        setCourse(found.semesterId, courseId, (current) => ({
          ...current,
          name: courseName || current.name,
          groups: nextGroups,
          showEditor: true,
          isCollapsed: false,
        }));
        setStatusByCourse((prev) => ({
          ...prev,
          [courseId]: `parsed ${file.name}. categories are ready to tweak.`,
        }));
        if (syllabusModalCourseId === courseId) setSyllabusModalCourseId(null);
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
      setSyllabusDraftText(text);
      const found = findCourse(courseId);
      if (!found) throw new Error("missing-course");
      setCourse(found.semesterId, courseId, (current) => ({ ...current, syllabusText: text }));
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

  const openSyllabusModal = (courseId: string) => {
    const found = findCourse(courseId);
    setSyllabusDraftText(found?.course?.syllabusText ?? "");
    setSyllabusModalCourseId(courseId);
  };

  const closeSyllabusModal = () => {
    setSyllabusModalCourseId(null);
    setSyllabusDraftText("");
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ semesters, version: 2 }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `gradepilot-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      const migrated = parseAndMigrateImport(raw);
      if (migrated) setSemesters(migrated);
    } finally {
      e.target.value = "";
    }
  };

  const moveItemWithinGroup = (courseId: string, groupId: string, fromItemId: string, toItemId: string) => {
    if (fromItemId === toItemId) return;

    const found = findCourse(courseId);
    if (!found) return;

    setCourse(found.semesterId, courseId, (current) => ({
      ...current,
      groups: current.groups.map((currentGroup) => {
        if (currentGroup.id !== groupId) return currentGroup;

        const fromIndex = currentGroup.items.findIndex((item) => item.id === fromItemId);
        const toIndex = currentGroup.items.findIndex((item) => item.id === toItemId);
        if (fromIndex < 0 || toIndex < 0) return currentGroup;

        const nextItems = [...currentGroup.items];
        const [moved] = nextItems.splice(fromIndex, 1);
        nextItems.splice(toIndex, 0, moved);

        return {
          ...currentGroup,
          items: nextItems,
        };
      }),
    }));
  };
  const totals = useMemo(() => {
    const allCourses = semesters.flatMap((semester) => semester.courses);
    const totalCredits = allCourses.reduce((sum, course) => sum + Math.max(course.credits, 0), 0);

    const maxTermPoints = allCourses.reduce((sum, course) => {
      const stats = courseStats(course);
      return sum + gradeToGpa(stats.maxPercent) * Math.max(course.credits, 0);
    }, 0);

    return {
      totalCredits,
      maxTermGpa: totalCredits > 0 ? maxTermPoints / totalCredits : 0,
    };
  }, [semesters]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_0%_0%,#fdf6e9_0%,#f6efe3_32%,#efe7d8_100%)] p-5 sm:p-8 dark:bg-[radial-gradient(circle_at_0%_0%,#1c1917_0%,#292524_32%,#1c1917_100%)] transition-colors duration-300">
      <div
        className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl border border-amber-900/20 bg-white/90 px-3 py-2 shadow-lg backdrop-blur-sm dark:border-amber-200/20 dark:bg-stone-900/90"
        role="group"
        aria-label="theme toggle"
      >
        <span className="text-xs font-medium text-amber-900/70 dark:text-amber-200/70">light</span>
        <Switch
          isSelected={theme === "dark"}
          onValueChange={(on) => setTheme(on ? "dark" : "light")}
          aria-label="dark mode"
          classNames={{
            wrapper: "transition-transform duration-200",
          }}
        />
        <span className="text-xs font-medium text-amber-900/70 dark:text-amber-200/70">dark</span>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(120,80,30,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(120,80,30,0.06)_1px,transparent_1px)] bg-[size:28px_28px] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)]" />
      <motion.div
        className="mx-auto flex w-full max-w-6xl flex-col gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <Card className="border border-amber-900/20 bg-white/80 shadow-[0_24px_80px_rgba(87,53,17,0.16)] backdrop-blur-sm dark:border-amber-200/20 dark:bg-stone-900/90 dark:shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
          <CardHeader className="flex flex-col items-start gap-2">
            <p className="font-[family-name:var(--font-instrument-serif)] text-4xl font-semibold tracking-tight text-amber-950 sm:text-5xl dark:text-amber-100">
              GradePilot
            </p>
            <p className="max-w-2xl font-[family-name:var(--font-bricolage)] text-amber-900/80 dark:text-amber-200/80">
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
              <Chip color="secondary" variant="flat">
                semesters: {semesters.length}
              </Chip>
              <Chip color="warning" variant="flat">
                autosave: on
              </Chip>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={importInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={importData}
              />
              <Button variant="flat" title="import from file" onPress={() => importInputRef.current?.click()}>
                import
              </Button>
              <Button variant="flat" title="export to file" onPress={exportData}>
                export
              </Button>
              <Button color="primary" isIconOnly aria-label="add semester" title="add semester" onPress={addSemester}>
                +
              </Button>
            </div>
          </CardBody>
        </Card>

        <div className="grid gap-4">
          {semesters.map((semester, semesterIndex) => (
            <Card key={semester.id} className="border border-amber-900/20 bg-white/85 shadow-[0_18px_54px_rgba(90,50,10,0.12)] dark:border-amber-200/20 dark:bg-stone-900/85 dark:shadow-[0_18px_54px_rgba(0,0,0,0.3)]">
              <CardBody className="grid gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="w-full max-w-xl space-y-2">
                    <Input
                      label={`semester ${semesterIndex + 1}`}
                      placeholder="ex: fall 2026"
                      value={semester.name}
                      onValueChange={(value) => setSemester(semester.id, (current) => ({ ...current, name: value }))}
                    />
                    <p className="text-xs text-amber-900/70 dark:text-amber-200/70">{semester.courses.length} classes</p>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button color="primary" title="add class" onPress={() => addCourse(semester.id)}>
                      add class
                    </Button>
                    <Button
                      variant="flat"
                      title={semester.isCollapsed ? "expand semester" : "collapse semester"}
                      onPress={() => toggleSemesterCollapsed(semester.id)}
                    >
                      {semester.isCollapsed ? "expand" : "collapse"}
                    </Button>
                    <Button
                      variant="light"
                      color="danger"
                      title="remove semester"
                      onPress={() => removeSemester(semester.id)}
                      isDisabled={semesters.length === 1}
                    >
                      remove
                    </Button>
                  </div>
                </div>

                {semester.isCollapsed ? null : (
                  <div className="grid gap-4">
                    {semester.courses.map((course, classIndex) => {
                      const stats = courseStats(course);
                      const targetPercent = clamp(course.target, 0, 100);
                      const isTargetReachable = stats.maxPercent + 0.001 >= targetPercent;
                      const progressToTarget = targetPercent > 0 ? clamp((stats.currentPercent / targetPercent) * 100, 0, 100) : 0;
                      const maxReachVsTarget = targetPercent > 0 ? clamp((stats.maxPercent / targetPercent) * 100, 0, 100) : 0;

                      return (
                        <Card
                          key={course.id}
                          className="border-2 border-amber-800/30 bg-white shadow-[0_4px_12px_rgba(87,53,17,0.12),0_0_0_1px_rgba(120,80,30,0.08)] dark:border-amber-200/30 dark:bg-stone-800 dark:shadow-[0_4px_12px_rgba(0,0,0,0.2),0_0_0_1px_rgba(251,191,36,0.15)]"
                        >
                          <CardBody className="grid gap-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                              <div className="w-full max-w-xl space-y-2">
                                <Input
                                  label={`class ${classIndex + 1}`}
                                  placeholder="ex: csc 120"
                                  value={course.name}
                                  onValueChange={(value) =>
                                    setCourse(semester.id, course.id, (current) => ({ ...current, name: value }))
                                  }
                                />
                                {course.showEditor && !course.isCollapsed ? (
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <Input
                                      type="number"
                                      label="credits"
                                      value={String(course.credits)}
                                      onValueChange={(value) =>
                                        setCourse(semester.id, course.id, (current) => ({ ...current, credits: toNum(value) }))
                                      }
                                    />
                                    <Input
                                      type="number"
                                      label="target final %"
                                      value={String(course.target)}
                                      onValueChange={(value) =>
                                        setCourse(semester.id, course.id, (current) => ({ ...current, target: toNum(value) }))
                                      }
                                    />
                                  </div>
                                ) : (
                                  <p className="text-xs text-amber-900/70 dark:text-amber-200/70">
                                    target {course.target}% / {course.credits} credits
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <Button color="primary" title="autofill with syllabus" onPress={() => openSyllabusModal(course.id)}>
                                  autofill with syllabus
                                </Button>

                                {course.showEditor ? (
                                  <Button
                                    variant="flat"
                                    title={course.isCollapsed ? "expand class" : "collapse class"}
                                    onPress={() => toggleCourseCollapsed(semester.id, course.id)}
                                  >
                                    {course.isCollapsed ? "expand" : "collapse"}
                                  </Button>
                                ) : null}

                                <Button
                                  variant="light"
                                  color="danger"
                                  title="remove class"
                                  onPress={() => removeCourse(semester.id, course.id)}
                                  isDisabled={semester.courses.length === 1}
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
                                {statusByCourse[course.id] ? (
                                  <p className="text-sm text-amber-900/75 dark:text-amber-200/75">{statusByCourse[course.id]}</p>
                                ) : null}

                                {course.showEditor ? (
                                  <>
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-amber-900/80 dark:text-amber-200/80">
                                      <p>
                                        current: {stats.currentPercent.toFixed(1)}% | target: {targetPercent.toFixed(1)}%
                                      </p>
                                      {isTargetReachable ? (
                                        <p>
                                          needed on remaining:{" "}
                                          {stats.neededAverageOnRemaining > 100
                                            ? "not possible"
                                            : `${stats.neededAverageOnRemaining.toFixed(1)}%`}
                                        </p>
                                      ) : (
                                        <p className="text-danger">target no longer reachable</p>
                                      )}
                                    </div>
                                    <Progress
                                      aria-label={isTargetReachable ? "progress to target" : "max achievable vs target"}
                                      value={isTargetReachable ? progressToTarget : maxReachVsTarget}
                                      color={isTargetReachable ? "primary" : "warning"}
                                    />
                                    {isTargetReachable ? (
                                      <p className="text-xs text-amber-900/70 dark:text-amber-200/70">keep this at 100% to stay on track for your target.</p>
                                    ) : (
                                      <p className="text-xs text-amber-900/70 dark:text-amber-200/70">
                                        max possible final is {stats.maxPercent.toFixed(1)}%, which is{" "}
                                        {Math.max(targetPercent - stats.maxPercent, 0).toFixed(1)}% below target.
                                      </p>
                                    )}
                                    <Divider />

                                    <div className="grid gap-3">
                                      {course.groups.map((group, groupIndex) => (
                                        <Card key={group.id} className="border border-stone-300/70 border-l-4 border-l-amber-500 bg-amber-50/95 shadow-[0_2px_8px_rgba(87,53,17,0.06)] dark:border-stone-600/70 dark:bg-stone-800/95 dark:shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
                                          <CardBody className="grid gap-3">
                                            <div className="grid gap-2 sm:grid-cols-12">
                                              <Input
                                                className="sm:col-span-5"
                                                label={`category ${groupIndex + 1}`}
                                                value={group.name}
                                                onValueChange={(value) =>
                                                  setCourse(semester.id, course.id, (current) => ({
                                                    ...current,
                                                    groups: current.groups.map((currentGroup) =>
                                                      currentGroup.id === group.id ? { ...currentGroup, name: value } : currentGroup,
                                                    ),
                                                  }))
                                                }
                                              />
                                              <Input
                                                className="sm:col-span-2"
                                                type="number"
                                                label="weight %"
                                                value={String(group.weight)}
                                                onValueChange={(value) =>
                                                  setCourse(semester.id, course.id, (current) => ({
                                                    ...current,
                                                    groups: current.groups.map((currentGroup) =>
                                                      currentGroup.id === group.id
                                                        ? { ...currentGroup, weight: toNum(value) }
                                                        : currentGroup,
                                                    ),
                                                  }))
                                                }
                                              />
                                              <Input
                                                className="sm:col-span-2"
                                                type="number"
                                                label="drop lowest"
                                                value={String(group.dropLowest)}
                                                onValueChange={(value) =>
                                                  setCourse(semester.id, course.id, (current) => ({
                                                    ...current,
                                                    groups: current.groups.map((currentGroup) =>
                                                      currentGroup.id === group.id
                                                        ? { ...currentGroup, dropLowest: Math.max(0, Math.floor(toNum(value))) }
                                                        : currentGroup,
                                                    ),
                                                  }))
                                                }
                                              />
                                              <div className="sm:col-span-3 flex items-end justify-end">
                                                <Button
                                                  variant="light"
                                                  color="danger"
                                                  title="remove category"
                                                  isDisabled={course.groups.length === 1}
                                                  onPress={() =>
                                                    setCourse(semester.id, course.id, (current) => ({
                                                      ...current,
                                                      groups:
                                                        current.groups.length > 1
                                                          ? current.groups.filter((currentGroup) => currentGroup.id !== group.id)
                                                          : current.groups,
                                                    }))
                                                  }
                                                >
                                                  x
                                                </Button>
                                              </div>
                                            </div>

                                            <button
                                              type="button"
                                              className="flex w-full items-center gap-3 rounded-xl border border-amber-900/20 bg-white/45 px-3 py-2 text-left text-amber-950 dark:border-amber-200/20 dark:bg-stone-700/50 dark:text-amber-100"
                                              onClick={() =>
                                                setCourse(semester.id, course.id, (current) => ({
                                                  ...current,
                                                  groups: current.groups.map((currentGroup) =>
                                                    currentGroup.id === group.id
                                                      ? { ...currentGroup, isItemsCollapsed: !currentGroup.isItemsCollapsed }
                                                      : currentGroup,
                                                  ),
                                                }))
                                              }
                                              aria-label={group.isItemsCollapsed ? "expand items" : "collapse items"}
                                              title={group.isItemsCollapsed ? "expand items" : "collapse items"}
                                            >
                                              <svg
                                                aria-hidden="true"
                                                viewBox="0 0 20 20"
                                                className={`h-4 w-4 shrink-0 transition-transform ${group.isItemsCollapsed ? "rotate-0" : "rotate-90"}`}
                                                fill="currentColor"
                                              >
                                                <path d="M7.3 5.2a1 1 0 0 1 1.4 0L12.8 9.3a1 1 0 0 1 0 1.4l-4.1 4.1a1 1 0 1 1-1.4-1.4L10.7 10 7.3 6.6a1 1 0 0 1 0-1.4Z" />
                                              </svg>
                                              <span className="text-sm font-medium">{group.items.length} {group.items.length === 1 ? "item" : "items"}</span>
                                            </button>

                                            <motion.div
                                              initial={false}
                                              animate={
                                                group.isItemsCollapsed ? { height: 0, opacity: 0 } : { height: "auto", opacity: 1 }
                                              }
                                              transition={{ duration: 0.22, ease: "easeInOut" }}
                                              className="flex flex-col gap-4 overflow-hidden"
                                            >
                                              <div className="grid gap-2">
                                                {group.items.length > 1 ? (
                                                  <p className="text-xs text-amber-900/65 dark:text-amber-200/65">
                                                    drag items to reorder inside this category
                                                  </p>
                                                ) : null}
                                                {group.items.map((item) => (
                                                  <div
                                                    key={item.id}
                                                    className={`grid items-end gap-2 rounded-lg border p-2 sm:grid-cols-12 ${dragOverItem?.courseId === course.id && dragOverItem?.groupId === group.id && dragOverItem?.itemId === item.id ? "border-amber-400 bg-amber-100/60 dark:border-amber-500 dark:bg-amber-900/40" : "border-transparent bg-white/35 dark:bg-stone-700/30"}`}
                                                    onDragOver={(event) => event.preventDefault()}
                                                    onDragEnter={() => {
                                                      if (!draggedItem) return;
                                                      if (draggedItem.courseId !== course.id || draggedItem.groupId !== group.id) return;
                                                      setDragOverItem({ courseId: course.id, groupId: group.id, itemId: item.id });
                                                    }}
                                                    onDragLeave={() => {
                                                      if (
                                                        dragOverItem?.itemId === item.id &&
                                                        dragOverItem?.groupId === group.id &&
                                                        dragOverItem?.courseId === course.id
                                                      ) {
                                                        setDragOverItem(null);
                                                      }
                                                    }}
                                                    onDrop={() => {
                                                      if (!draggedItem) return;
                                                      if (draggedItem.courseId !== course.id || draggedItem.groupId !== group.id) return;
                                                      moveItemWithinGroup(course.id, group.id, draggedItem.itemId, item.id);
                                                      setDraggedItem(null);
                                                      setDragOverItem(null);
                                                    }}
                                                  >
                                                    <div className="sm:col-span-1 flex h-full items-center justify-center pb-2 text-amber-900/45 dark:text-amber-200/50">
                                                      <button
                                                        type="button"
                                                        className="cursor-grab rounded p-1 active:cursor-grabbing"
                                                        draggable
                                                        title="drag handle"
                                                        aria-label="drag handle"
                                                        onDragStart={() =>
                                                          setDraggedItem({ courseId: course.id, groupId: group.id, itemId: item.id })
                                                        }
                                                        onDragEnd={() => {
                                                          setDraggedItem(null);
                                                          setDragOverItem(null);
                                                        }}
                                                      >
                                                        <svg
                                                          aria-hidden="true"
                                                          viewBox="0 0 20 20"
                                                          className="h-4 w-4"
                                                          fill="currentColor"
                                                        >
                                                          <circle cx="6" cy="4.5" r="1.2" />
                                                          <circle cx="14" cy="4.5" r="1.2" />
                                                          <circle cx="6" cy="10" r="1.2" />
                                                          <circle cx="14" cy="10" r="1.2" />
                                                          <circle cx="6" cy="15.5" r="1.2" />
                                                          <circle cx="14" cy="15.5" r="1.2" />
                                                        </svg>
                                                      </button>
                                                    </div>
                                                    <Input
                                                      className="sm:col-span-5 w-full"
                                                      label="item"
                                                      value={item.name}
                                                      onValueChange={(value) =>
                                                        setCourse(semester.id, course.id, (current) => ({
                                                          ...current,
                                                          groups: current.groups.map((currentGroup) =>
                                                            currentGroup.id === group.id
                                                              ? {
                                                                  ...currentGroup,
                                                                  items: currentGroup.items.map((currentItem) =>
                                                                    currentItem.id === item.id
                                                                      ? { ...currentItem, name: value }
                                                                      : currentItem,
                                                                  ),
                                                                }
                                                              : currentGroup,
                                                          ),
                                                        }))
                                                      }
                                                    />
                                                    <Input
                                                      className="sm:col-span-3 w-full"
                                                      type="number"
                                                      label="score"
                                                      placeholder="blank = not graded"
                                                      value={item.score}
                                                      onValueChange={(value) =>
                                                        setCourse(semester.id, course.id, (current) => ({
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
                                                      className="sm:col-span-2 w-full"
                                                      type="number"
                                                      label="out of"
                                                      value={item.max}
                                                      onValueChange={(value) =>
                                                        setCourse(semester.id, course.id, (current) => ({
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
                                                    <div className="sm:col-span-1 flex items-end justify-end justify-self-end">
                                                      <Button
                                                        variant="light"
                                                        color="danger"
                                                        title="remove item"
                                                        isDisabled={group.items.length === 1}
                                                        onPress={() =>
                                                          setCourse(semester.id, course.id, (current) => ({
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

                                              <div className="flex justify-end pt-1">
                                                <Button
                                                  variant="flat"
                                                  onPress={() =>
                                                    setCourse(semester.id, course.id, (current) => ({
                                                      ...current,
                                                      groups: current.groups.map((currentGroup) =>
                                                        currentGroup.id === group.id
                                                          ? {
                                                              ...currentGroup,
                                                              items: [
                                                                ...currentGroup.items,
                                                                createItem(`item ${currentGroup.items.length + 1}`),
                                                              ],
                                                            }
                                                          : currentGroup,
                                                      ),
                                                    }))
                                                  }
                                                >
                                                  +
                                                </Button>
                                              </div>
                                            </motion.div>
                                          </CardBody>
                                        </Card>
                                      ))}
                                    </div>

                                    <div className="flex justify-end">
                                      <Button
                                        variant="flat"
                                        color="primary"
                                        title="add category"
                                        onPress={() =>
                                          setCourse(semester.id, course.id, (current) => ({
                                            ...current,
                                            groups: [...current.groups, createGroup(`category ${current.groups.length + 1}`, 10)],
                                          }))
                                        }
                                      >
                                        +
                                      </Button>
                                    </div>
                                  </>
                                ) : (
                                  <Card className="bg-amber-50/80 shadow-none dark:bg-stone-800/80">
                                    <CardBody className="gap-2">
                                      <p className="text-sm text-amber-900/80 dark:text-amber-200/80">
                                        start simple: tap autofill with syllabus, then analyze from the popup.
                                      </p>
                                      <div className="flex justify-end">
                                        <Button
                                          variant="light"
                                          title="manual setup"
                                          onPress={() => openManualSetup(semester.id, course.id)}
                                        >
                                          manual setup
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
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      </motion.div>

      <Modal isOpen={Boolean(syllabusModalCourseId)} onOpenChange={(open) => (!open ? closeSyllabusModal() : null)}>
        <ModalContent>
          <ModalHeader className="font-[family-name:var(--font-manrope)]">autofill with syllabus</ModalHeader>
          <ModalBody className="grid gap-4">
            <Textarea
              label="paste syllabus text"
              placeholder="paste your syllabus grading section here"
              value={syllabusDraftText}
              minRows={6}
              onValueChange={setSyllabusDraftText}
            />

            <div className="grid gap-2">
              <p className="text-sm text-amber-900/70 dark:text-amber-200/70">or upload syllabus file (.pdf, .txt, .md, .csv)</p>
              <input
                type="file"
                accept=".pdf,.txt,.md,.csv,text/*,application/pdf"
                onChange={(event) => {
                  if (!syllabusModalCourseId) return;
                  const file = event.currentTarget.files?.[0] || null;
                  void uploadSyllabusFile(syllabusModalCourseId, file);
                  event.currentTarget.value = "";
                }}
                className="block w-full text-sm text-amber-900/70 dark:text-amber-200/70 file:mr-3 file:rounded-xl file:border file:border-amber-900/30 file:bg-amber-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-amber-900 hover:file:bg-amber-200 dark:file:border-amber-200/30 dark:file:bg-amber-900/50 dark:file:text-amber-100 dark:hover:file:bg-amber-800/60"
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={closeSyllabusModal}>
              cancel
            </Button>
            <Button
              color="primary"
              isLoading={syllabusModalCourseId !== null && ingestingCourseId === syllabusModalCourseId}
              onPress={async () => {
                if (!syllabusModalCourseId) return;
                const targetCourseId = syllabusModalCourseId;
                const found = findCourse(targetCourseId);
                if (!found) return;
                setCourse(found.semesterId, targetCourseId, (current) => ({ ...current, syllabusText: syllabusDraftText }));
                await ingestSyllabus(targetCourseId, syllabusDraftText);
                closeSyllabusModal();
              }}
            >
              analyze syllabus
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}





















































