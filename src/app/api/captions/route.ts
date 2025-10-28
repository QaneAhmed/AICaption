import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Mode = "captions" | "bio";
type Tone = "funny" | "poetic" | "classy" | "branded";

type CaptionItem = { text: string; hashtags: string };
type BioItem = { text: string };

const allowedTones: Tone[] = ["funny", "poetic", "classy", "branded"];

const systemPrompt =
  "You are Caption Coach, a sharp and safe social media copywriter. You write concise, engaging, brand-safe captions or short bios. Keep everything family-friendly and culturally respectful. Avoid medical/financial claims, controversial topics, and disallowed hashtags.";

const maxCaptionGuidanceLength = 280;
const minBioGuidanceLength = 10;
const maxBioGuidanceLength = 400;
const maxCharsMin = 40;
const maxCharsMax = 220;

const MAX_OPENAI_ATTEMPTS = 3;

async function callOpenAI(messages: OpenAI.ChatCompletionMessageParam[]) {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= MAX_OPENAI_ATTEMPTS; attempt += 1) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.8,
        messages,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response from model");
      }

      if (typeof content === "string") {
        return content.trim();
      }

      if (Array.isArray(content)) {
        const parts = content as Array<
          | string
          | {
              text?: string | null;
            }
        >;

        return parts
          .map((part) => {
            if (typeof part === "string") return part;
            if ("text" in part && part.text) return part.text;
            return "";
          })
          .join("\n")
          .trim();
      }

      return String(content).trim();
    } catch (error) {
      lastError = error;

      if (error instanceof OpenAI.RateLimitError || (error as { status?: number }).status === 429) {
        const headers = (error as { headers?: Headers }).headers;
        const retryAfterHeader = headers?.get?.("retry-after");
        const retryAfterSeconds = retryAfterHeader ? Number.parseFloat(retryAfterHeader) : NaN;
        const waitSeconds = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0 ? retryAfterSeconds : 20;

        if (attempt === MAX_OPENAI_ATTEMPTS) {
          break;
        }

        await sleep(waitSeconds * 1000);
        continue;
      }

      throw error;
    }
  }

  throw lastError ?? new Error("OpenAI request failed");
}

function sleep(durationMs: number) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

function parseCaptionsPayload(raw: string) {
  const parsed = JSON.parse(raw) as {
    items?: Array<{ text: unknown; hashtags: unknown }>;
  };

  if (
    !parsed?.items ||
    !Array.isArray(parsed.items) ||
    parsed.items.length !== 5
  ) {
    throw new Error("Invalid captions payload");
  }

  const items: CaptionItem[] = parsed.items.map((item) => {
    if (
      !item ||
      typeof item.text !== "string" ||
      typeof item.hashtags !== "string"
    ) {
      throw new Error("Invalid caption item");
    }
    return {
      text: item.text.trim(),
      hashtags: item.hashtags.trim(),
    };
  });

  return items;
}

function parseBioPayload(raw: string) {
  const parsed = JSON.parse(raw) as {
    items?: Array<{ text: unknown }>;
  };

  if (
    !parsed?.items ||
    !Array.isArray(parsed.items) ||
    parsed.items.length !== 3
  ) {
    throw new Error("Invalid bio payload");
  }

  const items: BioItem[] = parsed.items.map((item) => {
    if (!item || typeof item.text !== "string") {
      throw new Error("Invalid bio item");
    }
    return { text: item.text.trim() };
  });

  return items;
}

function buildFallbackCaptions(): CaptionItem[] {
  return [
    {
      text: "Fresh perspective coming your way—stay tuned for the full story behind this shot.",
      hashtags: "#behindthescenes #brandmoments #staytuned #socialready #captioncoach #storyteaser #creativepulse #shareworthy",
    },
    {
      text: "Setting the scene with style while we polish the perfect caption for your feed.",
      hashtags: "#freshcaption #feedgoals #styleinspo #captioncoach #brandvibes #contentcrew #socialspark #stayready",
    },
    {
      text: "A dose of personality is on deck—your tailored caption will land the moment the coach is ready.",
      hashtags: "#captionscoming #brandvoice #socialenergy #captioncoach #contentmagic #creativeflow #onbrand #watchthisspace",
    },
    {
      text: "We are lining up details that hit the right tone—this placeholder keeps the post warm.",
      hashtags: "#tonecheck #brandready #captioncoach #socialsuite #creativeprep #marketingmadeeasy #contentqueue #comingsoon",
    },
    {
      text: "This space is saving your prime caption real estate while the coach finalizes the perfect copy.",
      hashtags: "#captioncoach #socialcaption #brandspotlight #contentstudio #marketingflow #creativeprep #stayposted #copyinprogress",
    },
  ];
}

function buildFallbackBios(): BioItem[] {
  return [
    {
      text: "Creating feel-good moments while celebrating the details that make this story unique.",
    },
    {
      text: "Sharing the highlights with warmth, purpose, and a spark of personality in every line.",
    },
    {
      text: "Telling the brand story with heart, clarity, and a voice that feels true to you.",
    },
  ];
}

export async function POST(request: Request) {
  let mode: Mode | null = null;

  try {
    const formData = await request.formData();
    const modeValue = formData.get("mode");

    if (modeValue !== "captions" && modeValue !== "bio") {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    mode = modeValue as Mode;

    if (!process.env.OPENAI_API_KEY) {
      if (mode === "captions") {
        return NextResponse.json(
          { mode, items: buildFallbackCaptions() },
          { status: 200 },
        );
      }

      return NextResponse.json({ mode, items: buildFallbackBios() }, { status: 200 });
    }

    const toneRaw = formData.get("tone");
    const tone =
      typeof toneRaw === "string"
        ? (toneRaw.toLowerCase() as Tone)
        : undefined;

    const guidanceRaw = formData.get("guidance");
    const guidance = typeof guidanceRaw === "string" ? guidanceRaw.trim() : "";

    const maxCharsRaw = formData.get("maxChars");
    const maxChars =
      typeof maxCharsRaw === "string" && maxCharsRaw.length > 0
        ? Number(maxCharsRaw)
        : undefined;

    if (
      maxChars !== undefined &&
      (!Number.isInteger(maxChars) ||
        maxChars < maxCharsMin ||
        maxChars > maxCharsMax)
    ) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    if (mode === "captions") {
      if (!tone || !allowedTones.includes(tone)) {
        return NextResponse.json({ error: "Invalid input" }, { status: 400 });
      }

      if (guidance.length > maxCaptionGuidanceLength) {
        return NextResponse.json({ error: "Invalid input" }, { status: 400 });
      }

      const image = formData.get("image");
      if (!(image instanceof File)) {
        return NextResponse.json({ error: "Invalid input" }, { status: 400 });
      }

      if (!["image/png", "image/jpeg"].includes(image.type)) {
        return NextResponse.json({ error: "Invalid input" }, { status: 400 });
      }

      if (image.size > 3 * 1024 * 1024) {
        return NextResponse.json({ error: "Invalid input" }, { status: 400 });
      }

      const arrayBuffer = await image.arrayBuffer();
      const base64Image = Buffer.from(arrayBuffer).toString("base64");
      const dataUrl = `data:${image.type};base64,${base64Image}`;

      const instruction = [
        "Task: Create exactly FIVE distinct, platform-ready captions for the provided image with the chosen tone and optional character limit. If guidance is provided, weave it naturally.",
        "",
        `Parameters:`,
        `- Tone: ${tone.charAt(0).toUpperCase()}${tone.slice(1)}`,
        `- Max characters: ${maxChars ?? "none"}`,
        `- Guidance (optional): ${guidance || "none"}`,
        "",
        "Constraints for each caption:",
        "- One sentence only. If Max characters is set, do not exceed it.",
        "- Avoid emoji unless Tone=Funny (max 2).",
        "- No brand claims or sensitive content.",
        "- Make the five captions meaningfully different in angle (humor, vibe, CTA).",
        "- If Guidance is provided, incorporate it naturally in at least two captions.",
        "",
        "Hashtags:",
        "- After each caption, create one line with 8–12 relevant hashtags.",
        "- Lowercase; no spammy/banned tags; avoid repetition.",
        "",
        "Output EXACTLY in JSON:",
        '{',
        '  "items": [',
        '    { "text": "caption #1", "hashtags": "#tag1 #tag2 #tag3 ..." },',
        '    { "text": "caption #2", "hashtags": "..." },',
        '    { "text": "caption #3", "hashtags": "..." },',
        '    { "text": "caption #4", "hashtags": "..." },',
        '    { "text": "caption #5", "hashtags": "..." }',
        "  ]",
        "}",
      ].join("\n");

      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: instruction },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ];

      let raw = await callOpenAI(messages);
      let items: CaptionItem[];

      try {
        items = parseCaptionsPayload(raw);
      } catch {
        const retryMessages: OpenAI.ChatCompletionMessageParam[] = [
          ...messages,
          { role: "assistant", content: raw },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "The previous reply was invalid. Respond again with VALID JSON matching the exact schema. Include no commentary.",
              },
            ],
          },
        ];

        try {
          raw = await callOpenAI(retryMessages);
          items = parseCaptionsPayload(raw);
        } catch {
          items = buildFallbackCaptions();
        }
      }

      return NextResponse.json({ mode, items });
    }

    // bio mode
    if (guidance.length < minBioGuidanceLength || guidance.length > maxBioGuidanceLength) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    if (tone && !allowedTones.includes(tone)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const effectiveTone =
      tone && allowedTones.includes(tone) ? tone : "classy";

    const instruction = [
      "Task: Create exactly THREE concise, polished bios/captions crafted from the user's About text.",
      "If a tone is provided, match it. Optionally respect a character limit.",
      "",
      "Parameters:",
      `- Tone (optional): ${effectiveTone.charAt(0).toUpperCase()}${effectiveTone.slice(1)}`,
      `- Max characters: ${maxChars ?? "none"}`,
      `- About: ${guidance}`,
      "",
      "Constraints:",
      "- Each output is one to two short sentences.",
      "- If Max characters is set, do not exceed it.",
      "- Keep it brand-safe, inclusive, and specific to the provided About text.",
      "- Vary the three options in angle (professional, personable, playful) while respecting Tone.",
      "",
      "Output EXACTLY in JSON:",
      '{',
      '  "items": [',
      '    { "text": "bio #1" },',
      '    { "text": "bio #2" },',
      '    { "text": "bio #3" }',
      "  ]",
      "}",
    ].join("\n");

    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: instruction },
    ];

    let raw = await callOpenAI(messages);
    let items: BioItem[];

    try {
      items = parseBioPayload(raw);
        } catch {
      const retryMessages: OpenAI.ChatCompletionMessageParam[] = [
        ...messages,
        { role: "assistant", content: raw },
        {
          role: "user",
          content:
            "The previous reply was invalid. Respond again with VALID JSON matching the schema. Include no commentary.",
        },
      ];

      try {
        raw = await callOpenAI(retryMessages);
        items = parseBioPayload(raw);
      } catch {
        items = buildFallbackBios();
      }
    }

    return NextResponse.json({ mode, items });
  } catch (error) {
    const fallback =
      mode === "captions"
        ? { mode: "captions" as const, items: buildFallbackCaptions() }
        : mode === "bio"
          ? { mode: "bio" as const, items: buildFallbackBios() }
          : null;

    if (error instanceof OpenAI.APIError) {
      if (error.status === 429) {
        if (fallback) {
          return NextResponse.json(fallback, { status: 200 });
        }

        return NextResponse.json(
          { error: "Easy there. Try again in a moment." },
          { status: 429 },
        );
      }

      if (error.status === 401 || error.status === 403) {
        return NextResponse.json(
          { error: "Check your OpenAI credentials." },
          { status: 500 },
        );
      }
    }

    if (fallback) {
      return NextResponse.json(fallback, { status: 200 });
    }

    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 },
    );
  }
}
