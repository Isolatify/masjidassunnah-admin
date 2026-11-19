import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSessionUser, unauthorized } from "@/lib/supabase/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const API_BASE = "https://gen.pollinations.ai";

// Pollinations' OpenAI-compatible /v1/images/edits currently treats `size` as
// HEIGHTxWIDTH for the gpt-image family: sending "1024x1536" returns a
// 1536x1024 landscape. We verify the result and retry once if it comes back
// portrait, so a future upstream fix cannot silently produce a portrait cover.
const MODEL = process.env.POLLINATIONS_IMAGE_MODEL || "openai/gpt-image-1-mini";
const SIZE = process.env.POLLINATIONS_IMAGE_SIZE || "1024x1536";

const PROMPT =
  "Turn this image into a wide landscape photo. Keep the same subject, people and " +
  "setting — only widen the frame so it is landscape.";

const MIME_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

function extOf(path: string): string {
  const clean = path.split("?")[0].split("#")[0];
  const ext = clean.split(".").pop()?.toLowerCase() || "";
  return MIME_BY_EXT[ext] ? ext : "png";
}

/** An error that carries the HTTP status the route should respond with. */
class AiError extends Error {
  constructor(message: string, readonly statusCode: number) {
    super(message);
    this.name = "AiError";
  }
}

/** Pollinations reports errors as either {error:{message}} or a flat {message}. */
function extractApiMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as {
      error?: { message?: string };
      message?: string;
    };
    return parsed?.error?.message || parsed?.message || raw.slice(0, 300);
  } catch {
    return raw.slice(0, 300);
  }
}

/** Turn a non-2xx Pollinations response into a short, actionable AiError. */
function describeFailure(status: number, raw: string): AiError {
  const apiMsg = extractApiMessage(raw);

  if (status === 401) {
    return new AiError(
      "AI not configured correctly — the Pollinations API key was rejected. Set POLLINATIONS_API_KEY.",
      503
    );
  }

  if (status === 402) {
    // "Insufficient balance. This request costs ~0.03 pollen, but your available balance is 0.015."
    const cost = apiMsg.match(/costs ~(\d+(?:\.\d+)?)/)?.[1];
    const balance = apiMsg.match(/available balance is (\d+(?:\.\d+)?)/)?.[1];
    const detail =
      cost && balance
        ? `Each image costs about ${cost} pollen but the account only has ${balance} left.`
        : "The Pollinations account has run out of pollen.";
    return new AiError(
      `AI image conversion is out of credit — ${detail} Top up at https://enter.pollinations.ai, or just use the original photo.`,
      402
    );
  }

  if (status === 429) {
    return new AiError(
      "AI is busy — rate limit hit. Please try again in a moment, or use the original photo.",
      429
    );
  }

  if (status === 400 && /Missing model parameter/i.test(apiMsg)) {
    return new AiError(`AI image conversion failed: unsupported model "${MODEL}".`, 500);
  }

  return new AiError(`Pollinations API error ${status}: ${apiMsg}`, 500);
}

/** Minimal JPEG/PNG dimension reader — enough to know if the result is landscape. */
function imageDimensions(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24) return null;

  // PNG: IHDR width/height are the 3rd and 4th big-endian words.
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }

  // JPEG: walk segments to a Start-Of-Frame marker (height then width).
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      const isSof =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSof) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }

  return null;
}

/** "1024x1536" -> "1536x1024"; leaves anything unparsable untouched. */
function swapSize(size: string): string {
  const match = size.match(/^(\d+)x(\d+)$/);
  return match ? `${match[2]}x${match[1]}` : size;
}

interface GeneratedImage {
  url?: string;
  b64_json?: string;
}

/** One call to /v1/images/edits. Throws AiError on any non-2xx response. */
async function requestEdit(
  apiKey: string,
  source: { bytes: Buffer; mime: string; ext: string },
  size: string
): Promise<GeneratedImage> {
  const form = new FormData();
  form.append("model", MODEL);
  form.append("prompt", PROMPT);
  // Node's Buffer is an ArrayBufferView<ArrayBufferLike>, which the DOM
  // BlobPart type rejects. Copying into a plain Uint8Array narrows it.
  form.append("image", new Blob([new Uint8Array(source.bytes)], { type: source.mime }), `source.${source.ext}`);
  form.append("size", size);
  form.append("response_format", "url");

  const res = await fetch(`${API_BASE}/v1/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  const text = await res.text();
  if (!res.ok) throw describeFailure(res.status, text);

  let parsed: { data?: GeneratedImage[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new AiError("AI returned an unexpected response", 500);
  }

  const first = parsed?.data?.[0];
  if (!first) throw new AiError("Model returned no image", 500);
  return first;
}

/** Download a generated image and normalise it to { bytes, mime }. */
async function downloadGenerated(mediaUrl: string): Promise<{ bytes: Buffer; mime: string }> {
  const dlRes = await fetch(mediaUrl);
  if (!dlRes.ok) throw new AiError("Could not fetch the generated image", 500);
  return {
    bytes: Buffer.from(await dlRes.arrayBuffer()),
    mime: dlRes.headers.get("content-type") || "image/jpeg",
  };
}

/** Decode a generated entry into bytes, trying the media URL first. */
async function materialise(image: GeneratedImage): Promise<{ bytes: Buffer; mime: string }> {
  if (image.url) return downloadGenerated(image.url);
  if (image.b64_json) return { bytes: Buffer.from(image.b64_json, "base64"), mime: "image/png" };
  throw new AiError("Model returned no image", 500);
}

/**
 * Generate a landscape version, retrying once with the size swapped if the
 * first result came back portrait (see the note on SIZE above).
 */
async function generateLandscape(
  apiKey: string,
  source: { bytes: Buffer; mime: string; ext: string }
): Promise<{ bytes: Buffer; mime: string }> {
  const first = await materialise(await requestEdit(apiKey, source, SIZE));

  const dims = imageDimensions(first.bytes);
  const cameBackPortrait = dims ? dims.h > dims.w : false;
  if (!cameBackPortrait) return first;

  try {
    const retry = await materialise(await requestEdit(apiKey, source, swapSize(SIZE)));
    const retryDims = imageDimensions(retry.bytes);
    // Accept the retry only if it actually improved the orientation.
    if (!retryDims || retryDims.w > retryDims.h) return retry;
  } catch {
    /* fall through and return the first result */
  }

  return first;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const body = await request.json();
  const { url } = body;

  if (!url || typeof url !== "string") {
    return NextResponse.json({ success: false, error: "Image URL is required" }, { status: 400 });
  }

  const apiKey = process.env.POLLINATIONS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "AI not configured. Set POLLINATIONS_API_KEY." },
      { status: 503 }
    );
  }

  try {
    // Fetch the source image (our own Supabase public URL).
    const imgRes = await fetch(url);
    if (!imgRes.ok) {
      return NextResponse.json(
        { success: false, error: "Could not fetch the source image" },
        { status: 400 }
      );
    }
    const srcExt = extOf(new URL(url).pathname);
    const srcMime = imgRes.headers.get("content-type") || MIME_BY_EXT[srcExt] || "image/jpeg";
    const srcBytes = Buffer.from(await imgRes.arrayBuffer());

    const { bytes, mime } = await generateLandscape(apiKey, {
      bytes: srcBytes,
      mime: srcMime,
      ext: srcExt,
    });

    // Pollinations media URLs expire (~30 days), so always persist into our own
    // "events" bucket — same as the manual /api/upload flow.
    const outExt = mime.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
    const fileName = `ai-${Date.now()}.${outExt}`;

    const { error: uploadError } = await supabase.storage.from("events").upload(fileName, bytes, {
      contentType: mime,
      cacheControl: "3600",
      upsert: false,
    });

    if (uploadError) throw new AiError(`Could not save AI image: ${uploadError.message}`, 500);

    const { data: urlData } = supabase.storage.from("events").getPublicUrl(fileName);
    return NextResponse.json({ success: true, url: urlData.publicUrl });
  } catch (err: unknown) {
    if (err instanceof AiError) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.statusCode });
    }
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "AI image conversion failed" },
      { status: 500 }
    );
  }
}
