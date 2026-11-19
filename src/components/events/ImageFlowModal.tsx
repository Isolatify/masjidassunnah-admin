"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  X,
  UploadSimple,
  Sparkle,
  ArrowRight,
  ArrowLeft,
  SpinnerGap,
  Check,
  Warning,
} from "@phosphor-icons/react";
import { toast } from "@/components/Toast";

/* Landscape window: skip AI when the photo is already roughly 16:9. */
const RATIO_MIN = 1.6;
const RATIO_MAX = 1.9;

type Step = "upload" | "preview" | "converting" | "choose";

interface ImageFlowModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with the finally-chosen image URL ("Use this photo"). */
  onDone: (url: string) => void;
  /** Optional pre-picked file (e.g. from hero drag-drop) — starts the flow on upload. */
  initialFile?: File | null;
}

export default function ImageFlowModal({ open, onClose, onDone, initialFile }: ImageFlowModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [originalUrl, setOriginalUrl] = useState("");
  const [originalRatio, setOriginalRatio] = useState(0);
  const [aiUrl, setAiUrl] = useState("");
  const [aiError, setAiError] = useState("");
  const [choice, setChoice] = useState<"original" | "ai">("ai");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset every time the modal opens.
  useEffect(() => {
    if (open) {
      setStep("upload");
      setUploading(false);
      setDragOver(false);
      setOriginalUrl("");
      setOriginalRatio(0);
      setAiUrl("");
      setAiError("");
      setChoice("ai");
    }
  }, [open]);

  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      const url: string = data.url;

      // Measure the natural size so we can skip AI on already-landscape photos.
      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve({ w: 0, h: 0 });
        img.src = url;
      });
      const ratio = dims.h > 0 ? dims.w / dims.h : 0;

      setOriginalUrl(url);
      setOriginalRatio(ratio);
      if (ratio >= RATIO_MIN && ratio <= RATIO_MAX) {
        // Already 16:9-ish — no conversion needed.
        setChoice("original");
        setStep("choose");
      } else {
        setStep("preview");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      setStep("upload");
    }
    setUploading(false);
  }, []);

  // Hero drag-drop hands us a pre-picked file — jump straight into the flow.
  useEffect(() => {
    if (open && initialFile) uploadFile(initialFile);
  }, [open, initialFile, uploadFile]);

  const convertWithAi = useCallback(async () => {
    setStep("converting");
    setAiError("");
    try {
      const res = await fetch("/api/events/ai-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: originalUrl }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "AI conversion failed");
      setAiUrl(data.url);
      setChoice("ai");
      setStep("choose");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "AI conversion failed";
      setAiError(msg);
      toast.error(msg);
      setChoice("original");
      setStep("choose");
    }
  }, [originalUrl]);

  const useThisPhoto = useCallback(() => {
    const url = choice === "ai" && aiUrl ? aiUrl : originalUrl;
    if (!url) return;
    onDone(url);
    onClose();
  }, [choice, aiUrl, originalUrl, onDone, onClose]);

  if (!open) return null;

  const closeBtn = (
    <button
      className="absolute top-4 right-4 z-10 grid h-9 w-9 place-items-center rounded-full border border-white/20 bg-black/40 text-white/80 backdrop-blur-sm transition-colors hover:border-gold hover:text-gold"
      onClick={onClose}
      aria-label="Close"
    >
      <X size={16} weight="bold" />
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl keep-radius border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line-soft px-7 py-5">
          <div>
            <div className="text-[10.5px] font-medium tracking-[0.26em] text-gold-deep uppercase">
              Event picture
            </div>
            <div className="mt-1 font-heading text-lg font-semibold text-ink">
              {step === "upload" && "Add a cover image"}
              {step === "preview" && "Looking good?"}
              {step === "converting" && "Converting to 16:9…"}
              {step === "choose" && "Pick your favourite"}
            </div>
          </div>
          {closeBtn}
        </div>

        <div className="p-7">
          {/* ── Step: upload ── */}
          {step === "upload" && (
            <div
              className={`flex min-h-[300px] cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl keep-radius border-2 border-dashed px-6 py-12 text-center transition-colors ${
                dragOver
                  ? "border-primary bg-primary-mist/50"
                  : "border-line bg-bg hover:border-primary-mist"
              }`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setDragOver(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) uploadFile(file);
              }}
            >
              {uploading ? (
                <>
                  <SpinnerGap size={34} className="spin text-primary" />
                  <p className="font-heading text-[15px] font-semibold text-ink">
                    Uploading…
                  </p>
                </>
              ) : (
                <>
                  <span className="grid h-16 w-16 place-items-center rounded-full bg-primary-mist text-primary">
                    <UploadSimple size={28} weight="duotone" />
                  </span>
                  <div>
                    <p className="font-heading text-[16px] font-semibold text-ink">
                      Tap to add picture
                    </p>
                    <p className="mt-1.5 text-[13.5px] text-muted">
                      or drag &amp; drop here — PNG, JPG or WebP
                    </p>
                  </div>
                  <span className="btn btn-gold btn-sm">
                    Choose image <ArrowRight size={14} weight="bold" />
                  </span>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFile(file);
                  e.target.value = "";
                }}
              />
            </div>
          )}

          {/* ── Step: preview (needs conversion) ── */}
          {step === "preview" && originalUrl && (
            <div>
              <div className="overflow-hidden rounded-2xl keep-radius border border-line-soft bg-bg-slab">
                <img
                  src={originalUrl}
                  alt="Uploaded event cover"
                  className="max-h-[360px] w-full object-contain"
                />
              </div>
              <p className="mt-4 flex items-start gap-2.5 text-[13.5px] leading-relaxed text-muted">
                <Warning size={16} weight="duotone" className="mt-0.5 shrink-0 text-gold-deep" />
                This photo isn&apos;t in a 16:9 landscape shape, so it would get cropped on the
                website. We can convert it to a full 1920&times;1080 landscape image with AI.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button className="btn btn-gold" onClick={convertWithAi}>
                  <Sparkle size={15} weight="duotone" /> Convert to 16:9 with AI
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setChoice("original");
                    setStep("choose");
                  }}
                >
                  Use as-is
                </button>
                <button
                  className="ml-auto flex items-center gap-1.5 text-[12.5px] font-medium text-muted transition-colors hover:text-primary"
                  onClick={() => setStep("upload")}
                >
                  <ArrowLeft size={13} weight="bold" /> Different photo
                </button>
              </div>
            </div>
          )}

          {/* ── Step: converting ── */}
          {step === "converting" && (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-4 text-center">
              <SpinnerGap size={38} className="spin text-primary" />
              <div>
                <p className="font-heading text-[16px] font-semibold text-ink">
                  Turning your image into landscape…
                </p>
                <p className="mt-1.5 text-[13.5px] text-muted">
                  This usually takes about 10–20 seconds.
                </p>
              </div>
            </div>
          )}

          {/* ── Step: choose (Original vs AI) ── */}
          {step === "choose" && originalUrl && (
            <div>
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Original */}
                <button
                  type="button"
                  onClick={() => setChoice("original")}
                  className={`group overflow-hidden rounded-2xl keep-radius border text-left transition-all ${
                    choice === "original"
                      ? "border-primary shadow-md ring-2 ring-primary/25"
                      : "border-line-soft hover:border-primary-mist"
                  }`}
                >
                  <div className="relative h-44 overflow-hidden bg-bg-slab">
                    <img
                      src={originalUrl}
                      alt="Original"
                      className="h-full w-full object-cover"
                    />
                    <span
                      className={`absolute top-3 right-3 grid h-6 w-6 place-items-center rounded-full border transition-colors ${
                        choice === "original"
                          ? "border-primary bg-primary text-white"
                          : "border-white/60 bg-black/30 text-transparent backdrop-blur-sm"
                      }`}
                    >
                      <Check size={13} weight="bold" />
                    </span>
                  </div>
                  <div className="px-4 py-3">
                    <p className="font-heading text-[14px] font-semibold text-ink">Original</p>
                    <p className="mt-0.5 text-[12px] text-muted">Exactly as you uploaded</p>
                  </div>
                </button>

                {/* AI */}
                {aiUrl ? (
                  <button
                    type="button"
                    onClick={() => setChoice("ai")}
                    className={`group overflow-hidden rounded-2xl keep-radius border text-left transition-all ${
                      choice === "ai"
                        ? "border-primary shadow-md ring-2 ring-primary/25"
                        : "border-line-soft hover:border-primary-mist"
                    }`}
                  >
                    <div className="relative h-44 overflow-hidden bg-bg-slab">
                      <img src={aiUrl} alt="AI landscape version" className="h-full w-full object-cover" />
                      <span className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-gold px-2.5 py-1 text-[9.5px] font-semibold tracking-[0.14em] text-primary-deep uppercase">
                        <Sparkle size={10} weight="fill" /> AI 16:9
                      </span>
                      <span
                        className={`absolute top-3 right-3 grid h-6 w-6 place-items-center rounded-full border transition-colors ${
                          choice === "ai"
                            ? "border-primary bg-primary text-white"
                            : "border-white/60 bg-black/30 text-transparent backdrop-blur-sm"
                        }`}
                      >
                        <Check size={13} weight="bold" />
                      </span>
                    </div>
                    <div className="px-4 py-3">
                      <p className="font-heading text-[14px] font-semibold text-ink">
                        AI landscape
                      </p>
                      <p className="mt-0.5 text-[12px] text-muted">
                        1920&times;1080 · fits the website hero
                      </p>
                    </div>
                  </button>
                ) : (
                  <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl keep-radius border border-dashed border-line bg-bg px-5 text-center">
                    <Sparkle size={22} weight="duotone" className="text-muted" />
                    <p className="text-[13px] leading-relaxed text-muted">
                      {aiError
                        ? `AI conversion failed — you can still use the original.`
                        : "No AI version available."}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button className="btn btn-gold" onClick={useThisPhoto}>
                  <Check size={15} weight="bold" /> Use this photo
                </button>
                {!aiUrl && (
                  <button className="btn btn-secondary" onClick={convertWithAi}>
                    <Sparkle size={14} weight="duotone" /> Try AI conversion again
                  </button>
                )}
                <button
                  className="ml-auto flex items-center gap-1.5 text-[12.5px] font-medium text-muted transition-colors hover:text-primary"
                  onClick={() => setStep("upload")}
                >
                  <ArrowLeft size={13} weight="bold" /> Start over
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
