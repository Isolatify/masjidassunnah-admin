import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/supabase/server";

interface ParsedDate {
  display: string;
  date_start: string;
  date_end: string | null;
  date_type: string;
  recurring_pattern: string | null;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await request.json();
  const { description } = body;

  if (!description?.trim()) {
    return NextResponse.json({ success: false, error: "Description is required" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "AI not configured. Set OPENAI_API_KEY." },
      { status: 503 }
    );
  }

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: `You are a date parsing assistant for a mosque event system.
The user will describe event timings in natural language. Parse them into structured JSON.

Rules:
- Always return valid JSON
- Use the user's description to determine dates
- Use today's date as reference for relative dates
- Today's date: ${new Date().toISOString().slice(0, 10)}

Return exactly this JSON structure (no markdown, no explanation):
{
  "display": "human-readable date summary",
  "date_start": "YYYY-MM-DD",
  "date_end": "YYYY-MM-DD or null",
  "date_type": "one-day" | "range" | "recurring",
  "recurring_pattern": "Every Sunday" | "Every Monday" | "Every Tuesday" | "Every Wednesday" | "Every Thursday" | "Every Friday" | "Every Saturday" | "Every Week" | "Every Month" | null
}

Examples:
- "Every Tuesday from 10am to 12pm starting March 5th" → date_type: "recurring", recurring_pattern: "Every Tuesday", date_start: "2025-03-05"
- "March 7-14 2027" → date_type: "range", date_start: "2027-03-07", date_end: "2027-03-14"
- "This Saturday 9am-11am" → date_type: "one-day", date_start: next Saturday's date
- "Every Friday after Jumu'ah" → date_type: "recurring", recurring_pattern: "Every Friday", date_start: next Friday's date`,
          },
          {
            role: "user",
            content: description,
          },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error(`OpenAI API error: ${res.status}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";

    let parsed: ParsedDate;
    try {
      const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        display: description,
        date_start: new Date().toISOString().slice(0, 10),
        date_end: null,
        date_type: "one-day",
        recurring_pattern: null,
      };
    }

    return NextResponse.json({ success: true, ...parsed });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Date parsing failed" },
      { status: 500 }
    );
  }
}
