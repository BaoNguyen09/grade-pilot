import { NextResponse } from "next/server";

type ParsedSyllabus = {
  components: Array<{
    name: string;
    weight: number;
    items: string[];
  }>;
};

export async function POST(request: Request) {
  try {
    const { syllabus } = (await request.json()) as { syllabus?: string };

    if (!syllabus || !syllabus.trim()) {
      return NextResponse.json({ error: "Missing syllabus text." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "No GEMINI_API_KEY found." }, { status: 503 });
    }

    const model = process.env.GEMINI_MODEL || "gemini-3-flash-preview";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: [
                    "extract grading categories from this syllabus and return strict json only.",
                    "format: {\"components\":[{\"name\":\"string\",\"weight\":number,\"items\":[\"string\"]}]}",
                    "if items are not explicit, return one generic item name.",
                    "",
                    syllabus,
                  ].join("\n"),
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                components: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      weight: { type: "number" },
                      items: { type: "array", items: { type: "string" } },
                    },
                    required: ["name", "weight", "items"],
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
      return NextResponse.json({ error: "Gemini parser request failed." }, { status: 502 });
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
      return NextResponse.json({ error: "Gemini response was empty." }, { status: 502 });
    }

    const cleanedJson = rawJson.replace(/^```json\s*|^```\s*|\s*```$/gim, "").trim();
    const parsed = JSON.parse(cleanedJson) as ParsedSyllabus;

    return NextResponse.json({ components: parsed.components || [] });
  } catch {
    return NextResponse.json({ error: "Could not parse syllabus right now." }, { status: 500 });
  }
}

