"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

type Mode = "captions" | "bio";
type Tone = "" | "funny" | "poetic" | "classy" | "branded";

type CaptionResult = {
  text: string;
  hashtags: string;
};

type BioResult = {
  text: string;
};

type ResultState =
  | { mode: "captions"; items: CaptionResult[] }
  | { mode: "bio"; items: BioResult[] };

const tones: Array<{ label: string; value: Exclude<Tone, ""> }> = [
  { label: "Funny", value: "funny" },
  { label: "Poetic", value: "poetic" },
  { label: "Classy", value: "classy" },
  { label: "Branded", value: "branded" },
];

const maxCaptionGuidanceLength = 280;
const minBioGuidanceLength = 10;
const maxBioGuidanceLength = 400;

const maxCharsMin = 40;
const maxCharsMax = 220;

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function CaptionCoachForm() {
  const [mode, setMode] = useState<Mode>("captions");
  const [tone, setTone] = useState<Tone>("");
  const [guidance, setGuidance] = useState("");
  const [maxChars, setMaxChars] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<ResultState | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!copiedKey) return;

    const timer = setTimeout(() => setCopiedKey(null), 2000);
    return () => clearTimeout(timer);
  }, [copiedKey]);

  const trimmedGuidance = guidance.trim();

  const guidanceLength = guidance.length;

  const guidanceIsValidForBio =
    trimmedGuidance.length >= minBioGuidanceLength &&
    trimmedGuidance.length <= maxBioGuidanceLength;

  const guidanceIsValidForCaptions = guidanceLength <= maxCaptionGuidanceLength;

  const maxCharsValue = maxChars ? Number(maxChars) : undefined;
  const maxCharsIsValid =
    !maxChars ||
    (Number.isInteger(maxCharsValue) &&
      maxCharsValue! >= maxCharsMin &&
      maxCharsValue! <= maxCharsMax);

  const ctaEnabled = useMemo(() => {
    if (!maxCharsIsValid) return false;

    if (mode === "captions") {
      return Boolean(imageFile) && tone !== "" && guidanceIsValidForCaptions;
    }

    // bio mode
    return guidanceIsValidForBio;
  }, [
    guidanceIsValidForBio,
    guidanceIsValidForCaptions,
    imageFile,
    maxCharsIsValid,
    mode,
    tone,
  ]);

  const guidanceLimitText =
    mode === "captions"
      ? `${guidanceLength}/${maxCaptionGuidanceLength}`
      : `${guidanceLength}/${maxBioGuidanceLength}`;

  function resetForMode(nextMode: Mode) {
    setMode(nextMode);
    setError(null);
    setResults(null);
    setImageError(null);

    if (nextMode === "bio") {
      setImageFile(null);
    }
  }

  function onModeChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value as Mode;
    resetForMode(next);
  }

  function onToneChange(event: ChangeEvent<HTMLInputElement>) {
    setTone(event.target.value as Tone);
  }

  function onGuidanceChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setGuidance(event.target.value);
  }

  function onMaxCharsChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    if (!value) {
      setMaxChars("");
      return;
    }

    const numeric = Number(value);
    if (Number.isNaN(numeric)) {
      return;
    }

    setMaxChars(String(Math.trunc(numeric)));
  }

  function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    setImageError(null);
    const files = event.target.files;
    if (!files || files.length === 0) {
      setImageFile(null);
      return;
    }

    const file = files[0];
    const validTypes = ["image/jpeg", "image/png"];
    if (!validTypes.includes(file.type)) {
      setImageFile(null);
      setImageError("Please upload a JPG or PNG image.");
      return;
    }

    const maxSizeMb = 3;
    if (file.size > maxSizeMb * 1024 * 1024) {
      setImageFile(null);
      setImageError("Image must be 3MB or smaller.");
      return;
    }

    setImageFile(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ctaEnabled) return;

    setIsSubmitting(true);
    setError(null);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append("mode", mode);

      if (mode === "captions") {
        if (imageFile) {
          formData.append("image", imageFile);
        }
        formData.append("tone", tone);
      } else if (tone) {
        formData.append("tone", tone);
      }

      if (trimmedGuidance) {
        formData.append("guidance", trimmedGuidance);
      }

      if (maxCharsValue && maxCharsIsValid) {
        formData.append("maxChars", String(maxCharsValue));
      }

      const response = await fetch("/api/captions", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        const message =
          payload?.error ??
          (response.status === 500
            ? "Something went wrong"
            : "Invalid input");
        setError(message);
        return;
      }

      const data = (await response.json()) as ResultState;
      setResults(data);
    } catch {
      setError("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCopy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
    } catch {
      setError("Unable to copy to clipboard.");
    }
  }

  return (
    <div className="space-y-10">
      <form className="space-y-8" onSubmit={handleSubmit}>
        <fieldset className="rounded-2xl border border-zinc-200 p-6">
          <legend className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Output Type
          </legend>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              {
                label: "Captions (image + optional guidance)",
                value: "captions" as Mode,
                description:
                  "Upload an image, pick a tone, optionally set limits and guidance.",
              },
              {
                label: "Bio (text only)",
                value: "bio" as Mode,
                description:
                  "Skip the image. Provide your About text for polished bios.",
              },
            ].map((option) => {
              const isActive = mode === option.value;
              return (
                <label
                  key={option.value}
                  className={classNames(
                    "flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition",
                    isActive
                      ? "border-[#6c5ce7] bg-[#f7f5ff]"
                      : "border-zinc-200 hover:border-[#6c5ce7]",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-zinc-900">
                      {option.label}
                    </span>
                    <input
                      type="radio"
                      name="mode"
                      value={option.value}
                      checked={isActive}
                      onChange={onModeChange}
                      className="h-4 w-4 accent-[#6c5ce7]"
                      aria-label={option.label}
                    />
                  </div>
                  <p className="text-sm text-zinc-600">{option.description}</p>
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-6 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="font-medium text-zinc-900">
                Upload image
                {mode === "captions" ? (
                  <span className="ml-2 text-xs font-semibold uppercase text-[#6c5ce7]">
                    Required
                  </span>
                ) : (
                  <span className="ml-2 text-xs text-zinc-500">Optional</span>
                )}
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg"
                disabled={mode === "bio"}
                onChange={onImageChange}
                className="block w-full text-sm text-zinc-600 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#6c5ce7] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:transition file:hover:bg-[#5843d8]"
              />
              <p className="text-xs text-zinc-500">
                JPG or PNG, up to 3MB. Guidance helps craft captions in at least
                two variants.
              </p>
              {imageFile && (
                <p className="text-sm text-zinc-700">
                  Selected:{" "}
                  <span className="font-medium text-[#6c5ce7]">
                    {imageFile.name}
                  </span>
                </p>
              )}
              {imageError && (
                <p className="text-sm text-red-500" role="alert">
                  {imageError}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <span className="font-medium text-zinc-900">
                Tone
                {mode === "captions" ? (
                  <span className="ml-2 text-xs font-semibold uppercase text-[#6c5ce7]">
                    Required
                  </span>
                ) : (
                  <span className="ml-2 text-xs text-zinc-500">
                    Optional (defaults to Classy)
                  </span>
                )}
              </span>
              <div className="grid grid-cols-2 gap-3">
                {tones.map((option) => {
                  const checked = tone === option.value;
                  return (
                    <label
                      key={option.value}
                      className={classNames(
                        "flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm transition",
                        checked
                          ? "border-[#6c5ce7] bg-[#f7f5ff] text-[#4334c9]"
                          : "border-zinc-200 text-zinc-600 hover:border-[#6c5ce7]",
                      )}
                    >
                      <span className="font-medium">{option.label}</span>
                      <input
                        type="radio"
                        name="tone"
                        value={option.value}
                        checked={checked}
                        onChange={onToneChange}
                        className="h-4 w-4 accent-[#6c5ce7]"
                        aria-label={option.label}
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="max-chars"
                className="font-medium text-zinc-900"
              >
                Max characters (optional)
              </label>
              <input
                id="max-chars"
                type="number"
                inputMode="numeric"
                min={maxCharsMin}
                max={maxCharsMax}
                placeholder="e.g. 120"
                value={maxChars}
                onChange={onMaxCharsChange}
                className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm text-zinc-700 shadow-sm outline-none ring-[#6c5ce7]/40 transition focus:border-[#6c5ce7] focus:ring-2"
              />
              <p className="text-xs text-zinc-500">
                Keep between {maxCharsMin} and {maxCharsMax} characters. Leave
                blank for no cap.
              </p>
              {!maxCharsIsValid && (
                <p className="text-sm text-red-500" role="alert">
                  Max characters must be between {maxCharsMin} and{" "}
                  {maxCharsMax}.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="guidance"
              className="font-medium text-zinc-900"
            >
              Things to mention, or write a short about blurb
              {mode === "bio" ? (
                <span className="ml-2 text-xs font-semibold uppercase text-[#6c5ce7]">
                  Required
                </span>
              ) : (
                <span className="ml-2 text-xs text-zinc-500">Optional</span>
              )}
            </label>
            <textarea
              id="guidance"
              name="guidance"
              rows={12}
              placeholder="e.g., brand is eco-friendly; mention weekend market; upbeat vibe — or I am Sara, indie baker in Stockholm; rye sourdough; dog mom"
              value={guidance}
              onChange={onGuidanceChange}
              maxLength={
                mode === "captions"
                  ? maxCaptionGuidanceLength
                  : maxBioGuidanceLength
              }
              className="h-full min-h-[280px] w-full rounded-2xl border border-zinc-200 px-4 py-4 text-sm leading-relaxed text-zinc-700 shadow-sm outline-none ring-[#6c5ce7]/40 transition focus:border-[#6c5ce7] focus:ring-2"
              aria-describedby="guidance-help"
            />
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <p id="guidance-help">
                Used as guidance for captions, or as the source text for bios.
              </p>
              <span>{guidanceLimitText}</span>
            </div>
            {mode === "bio" && guidance.length > 0 && !guidanceIsValidForBio && (
              <p className="text-sm text-red-500" role="alert">
                About text must be between {minBioGuidanceLength} and{" "}
                {maxBioGuidanceLength} characters.
              </p>
            )}
            {mode === "captions" &&
              guidance.length > maxCaptionGuidanceLength && (
                <p className="text-sm text-red-500" role="alert">
                  Guidance must be {maxCaptionGuidanceLength} characters or
                  fewer.
                </p>
              )}
          </div>
        </div>

        {error && (
          <div
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="flex items-center justify-end">
          <button
            type="submit"
            disabled={!ctaEnabled || isSubmitting}
            className={classNames(
              "inline-flex items-center gap-2 rounded-xl bg-[#6c5ce7] px-6 py-3 text-sm font-medium text-white transition",
              ctaEnabled && !isSubmitting
                ? "hover:bg-[#5843d8]"
                : "cursor-not-allowed opacity-60",
            )}
          >
            {isSubmitting ? "Drafting your best lines…" : "Generate"}
          </button>
        </div>
      </form>

      {results && (
        <section className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              {results.mode === "captions"
                ? "Your caption set"
                : "Your bio options"}
            </h2>
            <p className="text-sm text-zinc-500">
              {results.mode === "captions"
                ? "Five distinct captions with hashtag lines."
                : "Three short bios crafted from your About text."}
            </p>
          </div>

          <div className="grid gap-4">
            {results.mode === "captions" &&
              results.items.map((item, index) => {
                const captionKey = `caption-${index}`;
                return (
                  <article
                    key={captionKey}
                    className="rounded-2xl border border-zinc-200 bg-[#fbfbff] p-5 shadow-sm"
                  >
                    <header className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-[#6c5ce7]">
                        Caption {index + 1}
                      </h3>
                      {copiedKey && copiedKey.startsWith(captionKey) && (
                        <span className="text-xs font-medium text-emerald-500">
                          Copied!
                        </span>
                      )}
                    </header>
                    <p className="mb-3 text-sm leading-relaxed text-zinc-800">
                      {item.text}
                    </p>
                    <p className="mb-4 text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Hashtags
                    </p>
                    <p className="text-sm text-zinc-600">{item.hashtags}</p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(item.text, `${captionKey}-text`)
                        }
                        className="rounded-lg border border-[#6c5ce7] px-4 py-2 text-xs font-semibold text-[#6c5ce7] transition hover:bg-[#6c5ce7] hover:text-white"
                      >
                        Copy caption
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            `${item.text}\n\n${item.hashtags}`,
                            `${captionKey}-full`,
                          )
                        }
                        className="rounded-lg border border-[#4334c9] bg-[#4334c9] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#3425b7]"
                      >
                        Copy with hashtags
                      </button>
                    </div>
                  </article>
                );
              })}

            {results.mode === "bio" &&
              results.items.map((item, index) => {
                const bioKey = `bio-${index}`;
                return (
                  <article
                    key={bioKey}
                    className="rounded-2xl border border-zinc-200 bg-[#fdfcff] p-5 shadow-sm"
                  >
                    <header className="mb-3 flex items-center justify-between">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-[#6c5ce7]">
                        Option {index + 1}
                      </h3>
                      {copiedKey === bioKey && (
                        <span className="text-xs font-medium text-emerald-500">
                          Copied!
                        </span>
                      )}
                    </header>
                    <p className="mb-4 text-sm leading-relaxed text-zinc-800">
                      {item.text}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCopy(item.text, bioKey)}
                      className="rounded-lg border border-[#6c5ce7] bg-[#6c5ce7] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#5843d8]"
                    >
                      Copy
                    </button>
                  </article>
                );
              })}
          </div>
        </section>
      )}
    </div>
  );
}
