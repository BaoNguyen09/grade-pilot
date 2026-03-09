"use client";

import { Button, Card, CardBody, CardHeader, Chip, Input, Progress } from "@heroui/react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

type Course = {
  id: string;
  name: string;
  credits: number;
  earned: number;
  possible: number;
  remaining: number;
  target: number;
};

const STORAGE_KEY = "gpa-planner-courses-v1";

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

const createCourse = (): Course => ({
  id: crypto.randomUUID(),
  name: "",
  credits: 3,
  earned: 0,
  possible: 0,
  remaining: 100,
  target: 90,
});

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([createCourse()]);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Course[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        setCourses(parsed);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(courses));
  }, [courses]);

  const updateCourse = (id: string, field: keyof Course, value: string) => {
    setCourses((prev) =>
      prev.map((course) => {
        if (course.id !== id) return course;
        if (field === "name") {
          return { ...course, name: value };
        }
        const number = Number(value);
        return { ...course, [field]: Number.isFinite(number) ? number : 0 };
      }),
    );
  };

  const totals = useMemo(() => {
    const totalCredits = courses.reduce((sum, c) => sum + Math.max(c.credits, 0), 0);
    const maxGpaPoints = courses.reduce((sum, c) => {
      const maxPercent =
        c.possible > 0 ? ((c.earned + Math.max(c.remaining, 0)) / c.possible) * 100 : 0;
      return sum + gradeToGpa(maxPercent) * Math.max(c.credits, 0);
    }, 0);
    return {
      totalCredits,
      maxTermGpa: totalCredits > 0 ? maxGpaPoints / totalCredits : 0,
    };
  }, [courses]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-white to-emerald-50 p-5 sm:p-8">
      <motion.div
        className="mx-auto flex w-full max-w-5xl flex-col gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <Card className="border border-sky-100 bg-white/90">
          <CardHeader className="flex flex-col items-start gap-2">
            <p className="font-[family-name:var(--font-space-grotesk)] text-3xl font-bold text-slate-800">
              bao&apos;s gpa planner
            </p>
            <p className="font-[family-name:var(--font-manrope)] text-slate-600">
              plan the best final grade you can still reach, even when the syllabus is unclear.
            </p>
          </CardHeader>
          <CardBody className="flex gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Chip color="primary" variant="flat">
                max term GPA: {totals.maxTermGpa.toFixed(2)}
              </Chip>
              <Chip color="success" variant="flat">
                total credits: {totals.totalCredits}
              </Chip>
            </div>
            <Button color="primary" onPress={() => setCourses((prev) => [...prev, createCourse()])}>
              add class
            </Button>
          </CardBody>
        </Card>

        <div className="grid gap-4">
          {courses.map((course, index) => {
            const currentPercent = course.possible > 0 ? (course.earned / course.possible) * 100 : 0;
            const maxFinalPercent =
              course.possible > 0 ? ((course.earned + Math.max(course.remaining, 0)) / course.possible) * 100 : 0;
            const neededOnRemaining =
              course.remaining > 0
                ? ((course.target / 100) * course.possible - course.earned) / course.remaining
                : 0;

            return (
              <Card key={course.id} className="border border-slate-200 bg-white/95">
                <CardBody className="grid gap-4">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input
                      label={`class ${index + 1}`}
                      placeholder="ex: csc 120"
                      value={course.name}
                      onValueChange={(value) => updateCourse(course.id, "name", value)}
                    />
                    <Input
                      type="number"
                      label="credits"
                      value={String(course.credits)}
                      onValueChange={(value) => updateCourse(course.id, "credits", value)}
                    />
                    <Input
                      type="number"
                      label="target final %"
                      value={String(course.target)}
                      onValueChange={(value) => updateCourse(course.id, "target", value)}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Input
                      type="number"
                      label="points earned so far"
                      value={String(course.earned)}
                      onValueChange={(value) => updateCourse(course.id, "earned", value)}
                    />
                    <Input
                      type="number"
                      label="points graded so far"
                      value={String(course.possible)}
                      onValueChange={(value) => updateCourse(course.id, "possible", value)}
                    />
                    <Input
                      type="number"
                      label="remaining points you can still earn"
                      value={String(course.remaining)}
                      onValueChange={(value) => updateCourse(course.id, "remaining", value)}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <Card className="bg-slate-50 shadow-none">
                      <CardBody className="gap-1">
                        <p className="text-sm text-slate-500">current grade</p>
                        <p className="text-2xl font-semibold text-slate-800">{currentPercent.toFixed(1)}%</p>
                      </CardBody>
                    </Card>
                    <Card className="bg-emerald-50 shadow-none">
                      <CardBody className="gap-1">
                        <p className="text-sm text-emerald-700">max final you can still hit</p>
                        <p className="text-2xl font-semibold text-emerald-800">{maxFinalPercent.toFixed(1)}%</p>
                      </CardBody>
                    </Card>
                    <Card className="bg-sky-50 shadow-none">
                      <CardBody className="gap-1">
                        <p className="text-sm text-sky-700">needed average on remaining work</p>
                        <p className="text-2xl font-semibold text-sky-800">
                          {(neededOnRemaining * 100).toFixed(1)}%
                        </p>
                      </CardBody>
                    </Card>
                  </div>

                  <Progress
                    aria-label="target progress"
                    value={Math.max(Math.min((currentPercent / Math.max(course.target, 1)) * 100, 100), 0)}
                    color="primary"
                    className="max-w-full"
                  />

                  <div className="flex justify-end">
                    <Button
                      variant="light"
                      color="danger"
                      onPress={() => setCourses((prev) => prev.filter((c) => c.id !== course.id))}
                      isDisabled={courses.length === 1}
                    >
                      remove class
                    </Button>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
