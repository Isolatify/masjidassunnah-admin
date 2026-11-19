"use client";

/* ==========================================================================
   Edit Prayer Times — a page, not a popup.

   Three states, in order:
     1. choose   — Athan or Iqamah?
     2. step 1   — the settings, and only the settings
     3. step 2   — after Next: the whole timetable, a − 0 + offset stepper
                   next to each athan (Athan only), then
                   "Do you want to proceed the change?" → Yes / No

   The settings and the preview are deliberately kept apart: nothing about the
   timetable is shown until Next is pressed.
   ========================================================================== */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BellRinging,
  Check,
  SpeakerHigh,
} from "@phosphor-icons/react";
import {
  ASR_OPTIONS,
  CALC_METHODS,
  CUSTOM_METHOD,
  HIGH_LATITUDE_OPTIONS,
  IQAMAH_KEYS,
  PRAYER_LABELS,
  prettyTime,
  zeroOffsets,
  type AthanConfig,
  type IqamahKey,
  type IqamahRule,
  type IqamahType,
  type PrayerConfig,
} from "@/lib/prayerConfig";
import type { ResolvedDay } from "@/lib/aladhan";
import {
  BACK_HREF,
  ConfirmBar,
  FooterActions,
  Loading,
  LoadError,
  ROW_STYLE,
  Segment,
  SettingsShell,
  Stepper,
  Timetable,
  previewDay,
  todayKey,
  usePrayerConfig,
} from "../settings-shared";
import s from "../page.module.css";

type Mode = "choose" | "athan" | "iqamah";

const IQAMAH_TYPES: { value: IqamahType; name: string }[] = [
  { value: "delay", name: "Delay after the athan" },
  { value: "fixed", name: "Fixed Time" },
  { value: "none", name: "No Iqamah" },
];

/** Everything about the athan settings except the offsets — the part the
 *  server needs to recompute a day. Stable while offsets change. */
function athanFingerprint(athan: AthanConfig): string {
  /* `JSON.stringify` drops undefined values, so this omits `offsets`
     without an unused destructured binding. */
  return JSON.stringify({ ...athan, offsets: undefined });
}

export default function EditPrayerTimesPage() {
  const router = useRouter();
  const { config, loaded, error, saving, set, save, reload } = usePrayerConfig();

  const [mode, setMode] = useState<Mode>("choose");
  const [step, setStep] = useState<1 | 2>(1);

  /* ── Review preview ───────────────────────────────────────────────────── */

  const [review, setReview] = useState<ResolvedDay | null>(null);
  const [failed, setFailed] = useState(false);

  /* Everything the server needs to recompute, minus the offsets — those are
     applied locally so tapping − 0 + never costs an Aladhan round trip. */
  const fingerprint = useMemo(() => {
    if (!config) return "";
    if (mode === "athan") return athanFingerprint(config.athan);
    return JSON.stringify(config.iqamah);
  }, [config, mode]);

  const [stampFp, setStampFp] = useState(fingerprint);
  if (stampFp !== fingerprint) {
    setStampFp(fingerprint);
    setReview(null);
    setFailed(false);
  }

  useEffect(() => {
    if (step !== 2 || !config) return;
    let alive = true;
    const t = window.setTimeout(() => {
      /* Clear a previous failure once the retry is genuinely under way. */
      setFailed(false);
      /* Athan review fetches with offsets stripped, then this file adds the
         draft offsets back on display. Iqamah review needs the real ones so
         the iqamah times line up with the shifted athans. */
      const payload: PrayerConfig =
        mode === "athan"
          ? { ...config, athan: { ...config.athan, offsets: zeroOffsets() } }
          : config;
      previewDay(payload, todayKey())
        .then((d) => {
          if (!alive) return;
          setReview(d);
          setFailed(false);
        })
        .catch(() => alive && setFailed(true));
    }, 300);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [step, mode, config]);

  /* Reference athans shown beside each iqamah rule while editing. */
  const [ref, setRef] = useState<ResolvedDay | null>(null);
  const athanFp = config ? athanFingerprint(config.athan) : "";
  useEffect(() => {
    if (mode !== "iqamah" || !config) return;
    let alive = true;
    const t = window.setTimeout(() => {
      previewDay({ ...config, athan: { ...config.athan, offsets: zeroOffsets() } }, todayKey())
        .then((d) => alive && setRef(d))
        .catch(() => undefined);
    }, 250);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [mode, config, athanFp]);

  /* ── Actions ──────────────────────────────────────────────────────────── */

  const blocked =
    mode === "athan" &&
    config?.athan.mode === "explicit" &&
    config.athan.methodId === CUSTOM_METHOD &&
    ((config.athan.fajrMode === "angle" && (config.athan.fajrAngle < 12 || config.athan.fajrAngle > 20)) ||
      (config.athan.ishaMode === "angle" && (config.athan.ishaAngle < 12 || config.athan.ishaAngle > 20)));

  const setOffset = (key: IqamahKey, value: number) => {
    const v = Math.max(-60, Math.min(60, value));
    set((c) => ({
      ...c,
      athan: { ...c.athan, offsets: { ...c.athan.offsets, [key]: v } },
    }));
  };

  const confirmYes = async () => {
    const res = await save(undefined, mode === "athan" ? "Athan settings saved" : "Iqamah settings saved");
    if (res.ok) router.push(BACK_HREF);
  };

  const confirmNo = () => {
    void reload();
    router.push(BACK_HREF);
  };

  /* ── States ───────────────────────────────────────────────────────────── */

  if (!loaded) {
    return (
      <SettingsShell eyebrow="Prayer Settings" title="Edit Prayer Times">
        <Loading />
      </SettingsShell>
    );
  }

  if (!config) {
    return (
      <SettingsShell eyebrow="Prayer Settings" title="Edit Prayer Times">
        <LoadError message={error || "The settings could not be read."} onRetry={() => void reload()} />
      </SettingsShell>
    );
  }

  const autosave = config.autosave;

  /* ── Step 0 — choose ──────────────────────────────────────────────────── */

  if (mode === "choose") {
    return (
      <SettingsShell
        eyebrow="Prayer Settings"
        title="What do you want to change?"
        sub="The adhan itself, or the iqamah that follows it."
      >
        <div className={s.choiceGrid}>
          <button className={s.choice} style={ROW_STYLE(0)} onClick={() => setMode("athan")}>
            <span className={s.choiceIcon}>
              <SpeakerHigh size={22} weight="fill" />
            </span>
            <span className={s.choiceName}>Athan</span>
            <span className={s.choiceDesc}>
              The calculation method, the Asr madhhab and the high-latitude rule that decide when
              the adhan is called.
            </span>
            <ArrowRight className={s.choiceArrow} size={18} weight="bold" />
          </button>

          <button className={s.choice} style={ROW_STYLE(1)} onClick={() => setMode("iqamah")}>
            <span className={s.choiceIcon}>
              <BellRinging size={22} weight="fill" />
            </span>
            <span className={s.choiceName}>Iqamah</span>
            <span className={s.choiceDesc}>
              A delay after the athan, a fixed time that never comes early, or no iqamah at all —
              set prayer by prayer.
            </span>
            <ArrowRight className={s.choiceArrow} size={18} weight="bold" />
          </button>
        </div>
      </SettingsShell>
    );
  }

  const isAthan = mode === "athan";

  /* ── Step 1 — settings only ───────────────────────────────────────────── */

  if (step === 1) {
    return (
      <SettingsShell
        eyebrow={isAthan ? "Prayer Settings · Athan" : "Prayer Settings · Iqamah"}
        title={isAthan ? "Edit Athan" : "Edit Iqamah"}
        sub={
          isAthan
            ? "Calculation method, Asr madhhab and the high-latitude rule."
            : "Delay after the athan, a fixed time, or no iqamah at all."
        }
        step={1}
        stepLabels={["Settings", "Review"]}
        foot={
          <FooterActions
            autosave={autosave}
            saving={saving}
            backLabel="Choose"
            onBack={() => {
              setMode("choose");
              setStep(1);
            }}
            nextLabel="Next"
            onNext={() => setStep(2)}
            nextDisabled={!!blocked}
          />
        }
      >
        {error && <span className={s.saveError}>{error}</span>}

        {isAthan ? (
          <AthanSettings config={config} set={set} />
        ) : (
          <IqamahSettings config={config} set={set} athan={ref} />
        )}

        {blocked && (
          <span className={s.saveError}>
            The Fajr and Isha angles must stay between 12° and 20°.
          </span>
        )}
      </SettingsShell>
    );
  }

  /* ── Step 2 — the timetable, then the confirm ─────────────────────────── */

  const busy = review === null && !failed;

  return (
    <SettingsShell
      eyebrow={isAthan ? "Prayer Settings · Athan" : "Prayer Settings · Iqamah"}
      title={isAthan ? "Athan Timetable" : "Iqamah Timetable"}
      sub={
        isAthan
          ? "Set an offset for any athan that needs nudging, then confirm."
          : "Check the iqamah times against the athan, then confirm."
      }
      step={2}
      stepLabels={["Settings", "Review"]}
      foot={
        autosave ? (
          /* Autosave on → there is nothing to confirm, so the save UI is gone. */
          <FooterActions
            autosave
            saving={saving}
            backLabel="Back to settings"
            onBack={() => setStep(1)}
            nextLabel="Done"
            onNext={() => router.push(BACK_HREF)}
          />
        ) : (
          <div className={s.confirmWrap}>
            <button type="button" className={s.btnGhost} onClick={() => setStep(1)} disabled={saving}>
              Back to settings
            </button>
            <ConfirmBar onYes={() => void confirmYes()} onNo={confirmNo} disabled={busy || failed} saving={saving} />
          </div>
        )
      }
    >
      <Timetable
        title={isAthan ? "Athan times" : "Athan & Iqamah"}
        meta={review?.methodUsed.name}
        day={review}
        offsets={isAthan ? config.athan.offsets : undefined}
        onOffset={isAthan ? setOffset : undefined}
        iqamah={!isAthan}
        busy={busy}
        failed={failed}
      />

      {review && (
        <span className={s.reviewDate}>
          {review.hijri.formatted} · {review.gregorian.weekday} {review.gregorian.day}{" "}
          {review.gregorian.month} {review.gregorian.year}
        </span>
      )}
    </SettingsShell>
  );
}

/* ==========================================================================
   Step 1 bodies
   ========================================================================== */

function AthanSettings({
  config,
  set,
}: {
  config: PrayerConfig;
  set: ReturnType<typeof usePrayerConfig>["set"];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const draft = config.athan;
  const patch = (p: Partial<AthanConfig>) => set((c) => ({ ...c, athan: { ...c.athan, ...p } }));
  const isCustom = draft.mode === "explicit" && draft.methodId === CUSTOM_METHOD;
  const current = CALC_METHODS.find((m) => m.id === (draft.mode === "automatic" ? -1 : draft.methodId));

  return (
    <>
      <div className={s.field}>
        <span className={s.fieldLabel}>Calculation Method</span>
        <button
          type="button"
          className={s.select}
          onClick={() => setPickerOpen((v) => !v)}
          style={{ textAlign: "left" }}
        >
          {current?.name ?? "Automatic"}
        </button>
        {pickerOpen && (
          <div className={s.optionList}>
            {CALC_METHODS.map((m, i) => {
              const selected = (draft.mode === "automatic" ? -1 : draft.methodId) === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`${s.option} ${selected ? s.optionActive : ""}`}
                  style={ROW_STYLE(i)}
                  onClick={() => {
                    patch(
                      m.id === -1
                        ? { mode: "automatic" }
                        : { mode: "explicit", methodId: m.id }
                    );
                    setPickerOpen(false);
                  }}
                >
                  <span className={`${s.optionDot} ${selected ? s.optionDotOn : ""}`} />
                  <span className={s.optionText}>
                    <strong>{m.name}</strong>
                    {m.note && <em>{m.note}</em>}
                  </span>
                  {selected && <Check className={s.optionCheck} size={15} weight="bold" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {isCustom && (
        <>
          <div className={s.subCard}>
            <h3 className={s.subTitle}>Fajr calculation method</h3>
            <Segment
              options={[
                { value: "angle", name: "Fajr Angle" },
                { value: "minutes", name: "Minutes before sunrise" },
              ]}
              value={draft.fajrMode}
              onChange={(v) => patch({ fajrMode: v })}
              small
            />
            {draft.fajrMode === "angle" ? (
              <>
                <Stepper
                  value={draft.fajrAngle}
                  onChange={(v) => patch({ fajrAngle: v })}
                  min={12}
                  max={20}
                  unit="°"
                />
                <span className={s.rangeNote}>Angle must be between 12° and 20°.</span>
              </>
            ) : (
              <Stepper
                value={draft.fajrMinutes}
                onChange={(v) => patch({ fajrMinutes: v })}
                min={1}
                max={180}
                unit="min before sunrise"
              />
            )}
          </div>

          <div className={s.subCard}>
            <h3 className={s.subTitle}>Isha calculation method</h3>
            <Segment
              options={[
                { value: "angle", name: "Isha Angle" },
                { value: "minutes", name: "Minutes after Maghrib" },
              ]}
              value={draft.ishaMode}
              onChange={(v) => patch({ ishaMode: v })}
              small
            />
            {draft.ishaMode === "angle" ? (
              <>
                <Stepper
                  value={draft.ishaAngle}
                  onChange={(v) => patch({ ishaAngle: v })}
                  min={12}
                  max={20}
                  unit="°"
                />
                <span className={s.rangeNote}>Angle must be between 12° and 20°.</span>
              </>
            ) : (
              <Stepper
                value={draft.ishaMinutes}
                onChange={(v) => patch({ ishaMinutes: v })}
                min={1}
                max={180}
                unit="min after Maghrib"
              />
            )}
          </div>
        </>
      )}

      <div className={s.field}>
        <span className={s.fieldLabel}>Asr Method</span>
        <Segment options={ASR_OPTIONS} value={draft.asrMethod} onChange={(v) => patch({ asrMethod: v })} small />
      </div>

      <div className={s.field}>
        <span className={s.fieldLabel}>High Latitude Rule</span>
        <Segment
          options={HIGH_LATITUDE_OPTIONS}
          value={draft.highLatitude}
          onChange={(v) => patch({ highLatitude: v })}
          small
        />
      </div>
    </>
  );
}

function IqamahSettings({
  config,
  set,
  athan,
}: {
  config: PrayerConfig;
  set: ReturnType<typeof usePrayerConfig>["set"];
  athan: ResolvedDay | null;
}) {
  const setRule = (key: IqamahKey, p: Partial<IqamahRule>) =>
    set((c) => ({ ...c, iqamah: { ...c.iqamah, [key]: { ...c.iqamah[key], ...p } } }));

  return (
    <div className={s.ruleList}>
      {IQAMAH_KEYS.map((key, i) => {
        const rule = config.iqamah[key];
        const at = athan?.timings[PRAYER_LABELS[key] as keyof ResolvedDay["timings"]];
        return (
          <div key={key} className={s.rule} style={ROW_STYLE(i)}>
            <div className={s.ruleHead}>
              <span className={s.ruleName}>{PRAYER_LABELS[key]}</span>
              <span className={s.ruleAthan}>Athan {at ? prettyTime(at) : "—"}</span>
            </div>
            <div className={s.ruleControls}>
              <Segment
                options={IQAMAH_TYPES}
                value={rule.type}
                onChange={(v) => setRule(key, { type: v })}
                small
              />
              {rule.type === "delay" && (
                <Stepper
                  value={rule.delay}
                  onChange={(v) => setRule(key, { delay: v })}
                  min={0}
                  max={180}
                  unit="min after athan"
                />
              )}
              {rule.type === "fixed" && (
                <input
                  className={s.input}
                  type="time"
                  value={rule.time}
                  onChange={(e) => setRule(key, { time: e.target.value })}
                  min={at || undefined}
                  style={{ maxWidth: 170 }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
