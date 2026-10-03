import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await request.json();
  const { text } = body;

  if (!text?.trim()) {
    return NextResponse.json({ success: false, error: "Text is required" }, { status: 400 });
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
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: `You are a professional editor for a mosque's event descriptions. 
Rewrite the user's text into polished, well-structured HTML suitable for a website.

Rules:
- Use <h3> for section headings (2-3 max)
- Use <ul> and <li> for bullet points where appropriate
- Use <strong> for emphasis on key details
- Use <p> for paragraphs
- Keep the tone warm, welcoming, and professional
- Do NOT include <html>, <head>, <body> tags — only inline HTML content
- Do NOT include markdown — output raw HTML only
- Preserve all factual information from the original
- If the text is already well-structured, improve it slightly and return
- Keep it concise but informative`,
          },
          {
            role: "user",
            content: text,
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error: ${res.status}`);
    }

    const data = await res.json();
    const rewritten = data.choices?.[0]?.message?.content || text;

    return NextResponse.json({ success: true, text: rewritten });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "AI rewrite failed" },
      { status: 500 }
    );
  }
}
