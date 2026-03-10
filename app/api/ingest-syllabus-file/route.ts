import { NextResponse } from "next/server";

type ParsedSyllabus = {
  courseName?: string;
  components: Array<{
    name: string;
    weight: number;
    dropLowest: number;
    items: string[];
  }>;
};

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file." }, { status: 400 });
    }

    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      return NextResponse.json({ error: "Only PDF files are supported." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "No GEMINI_API_KEY found." }, { status: 503 });
    }

    const model = process.env.GEMINI_MODEL || "gemini-3-flash-preview";
    const fileBytes = Buffer.from(await file.arrayBuffer());

    if (fileBytes.length > 20 * 1024 * 1024) {
      return NextResponse.json({ error: "PDF too large. Keep it under 20MB." }, { status: 413 });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: [
                    "extract the course/class name (e.g. \"CSC 120\" or \"Introduction to Programming\") and grading categories from this syllabus pdf. return strict json only.",
                    "format: {\"courseName\":\"string\",\"components\":[{\"name\":\"string\",\"weight\":number,\"dropLowest\":number,\"items\":[\"string\"]}]}",
                    "courseName: the course code or full course title from the syllabus. if unclear, use empty string.",
                    "if item names are missing, return one generic item name per category. if no drop rule exists, set dropLowest to 0.",
                  ].join("\n"),
                },
                {
                  inlineData: {
                    mimeType: "application/pdf",
                    data: fileBytes.toString("base64"),
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                courseName: { type: "string" },
                components: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      weight: { type: "number" },
                      dropLowest: { type: "number" },
                      items: { type: "array", items: { type: "string" } },
                    },
                    required: ["name", "weight", "dropLowest", "items"],
                  },
                },
              },
              required: ["components"],
            },
          },
        }),
      },
    );

    if (!response.ok) {
      return NextResponse.json({ error: "Gemini PDF parser request failed." }, { status: 502 });
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: {
          parts?: Array<{ text?: string }>;
        };
      }>;
    };

    const rawJson = data.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === "string")?.text;

    if (!rawJson) {
      return NextResponse.json({ error: "Gemini PDF response was empty." }, { status: 502 });
    }

    const cleanedJson = rawJson.replace(/^```json\s*|^```\s*|\s*```$/gim, "").trim();
    const parsed = JSON.parse(cleanedJson) as ParsedSyllabus;

    return NextResponse.json({ courseName: parsed.courseName ?? "", components: parsed.components || [] });
  } catch {
    return NextResponse.json({ error: "Could not parse PDF syllabus right now." }, { status: 500 });
  }
}

