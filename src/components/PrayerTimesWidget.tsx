"use client";

import { useState, useEffect } from "react";
import {
  SunDim,
  Sun,
  SunHorizon,
  StarHalf,
  MoonStars,
  UsersThree,
  CaretLeft,
  CaretRight,
  IconProps,
} from "@phosphor-icons/react";
import {
  getDayPrayers,
  getNextPrayer,
  getCountdownParts,
  getElapsedParts,
  getNavLabel,
  getDaysFromToday,
  startOfToday,
  Week,
} from "@/lib/prayerTimes";

const ICONS: Record<string, React.ComponentType<IconProps>> = {
  Fajr: SunDim,
  Shuruq: SunHorizon,
  Dhuhr: Sun,
  Jumuah: UsersThree,
  Asr: StarHalf,
  Maghrib: MoonStars,
  Isha: MoonStars,
};

function addDaysLocal(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function PrayerTimesWidget({ week }: { week: Week | null }) {
  const [navDate, setNavDate] = useState<Date>(startOfToday());
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!week) {
    return <div className="prayer__widget" style={{ minHeight: 400 }} />;
  }

  const daysFromToday = getDaysFromToday(navDate);
  const prayers = getDayPrayers(week, navDate) || [];

  let left: {
    prayer: { name: string; arabic: string; athan: string; iqamah: string };
    cd: { hours: string; minutes: string; seconds: string } | null;
    sub: string;
    showIqamah: boolean;
    iqamah: string | null;
  } | null = null;
  let activeKey: string | null = null;

  if (daysFromToday === 0) {
    const nextPrayers = getDayPrayers(week, addDaysLocal(navDate, 1)) || [];
    const state = getNextPrayer(prayers, now, nextPrayers);
    if (state) {
      const targetDate = state.nextDay ? addDaysLocal(navDate, 1) : navDate;
      const cd = getCountdownParts(targetDate, state.targetTime, now);
      const sub =
        state.phase === "iqamah"
          ? `until the Iqama at ${state.targetTime}`
          : `until the Athan at ${state.targetTime}`;
      left = {
        prayer: state.prayer,
        cd,
        sub,
        showIqamah: state.showIqamah && !!cd,
        iqamah: state.prayer?.iqamah,
      };
      activeKey = state.prayer.key;
    }
  } else if (daysFromToday > 0) {
    const fajr = prayers.find((p) => p.key === "fajr");
    if (fajr) {
      const cd = getCountdownParts(navDate, fajr.athan, now);
      left = {
        prayer: fajr,
        cd,
        sub: `until the Athan at ${fajr.athan}`,
        showIqamah: !!cd,
        iqamah: fajr.iqamah,
      };
      activeKey = "fajr";
    }
  } else {
    const isha = prayers.find((p) => p.key === "isha");
    if (isha) {
      const cd = getElapsedParts(navDate, isha.iqamah, now);
      left = {
        prayer: isha,
        cd,
        sub: `since the Iqama at ${isha.iqamah}`,
        showIqamah: false,
        iqamah: null,
      };
      activeKey = "isha";
    }
  }

  const prevDay = () => setNavDate((d) => addDaysLocal(d, -1));
  const nextDay = () => setNavDate((d) => addDaysLocal(d, 1));

  return (
    <div className="prayer__widget">
      <div className="prayer__left">
        {left ? (
          <>
            <span className="prayer__left-label">{left.prayer.name}</span>
            <span className="prayer__left-arabic">{left.prayer.arabic}</span>
            {left.cd ? (
              <>
                <div className="prayer__countdown">
                  <div className="prayer__cd">
                    <b className="prayer__cd-num">{left.cd.hours}</b>
                    <span className="prayer__cd-unit">hrs</span>
                  </div>
                  <div className="prayer__cd">
                    <b className="prayer__cd-num">{left.cd.minutes}</b>
                    <span className="prayer__cd-unit">mins</span>
                  </div>
                  <div className="prayer__cd prayer__cd--gold">
                    <b className="prayer__cd-num">{left.cd.seconds}</b>
                    <span className="prayer__cd-unit">secs</span>
                  </div>
                </div>
                <p className="prayer__left-sub">{left.sub}</p>
                {left.showIqamah && (
                  <p className="prayer__left-iqamah">
                    IQAMAH <strong>{left.iqamah}</strong>
                  </p>
                )}
              </>
            ) : (
              <p className="prayer__left-sub">Check prayer times for today</p>
            )}
          </>
        ) : (
          <p className="prayer__left-sub">Check prayer times for today</p>
        )}
      </div>

      <div className="prayer__right">
        <div className="prayer__tabs prayer__daynav">
          <button
            type="button"
            className="prayer__daybtn"
            onClick={prevDay}
            aria-label="Previous day"
          >
            <CaretLeft size={16} weight="bold" />
          </button>
          <span className="prayer__daylabel">{getNavLabel(navDate)}</span>
          <button
            type="button"
            className="prayer__daybtn"
            onClick={nextDay}
            aria-label="Next day"
          >
            <CaretRight size={16} weight="bold" />
          </button>
        </div>

        <div className="prayer__table-head">
          <span></span>
          <span></span>
          <span>Athan</span>
          <span>Iqamah</span>
        </div>

        {prayers.map((p) => {
          const Icon = ICONS[p.name] || Sun;
          return (
            <div
              key={p.name}
              className={`prayer__row ${p.key === activeKey ? "prayer__row--active" : ""}`}
            >
              <span className="prayer__row-icon">
                <Icon size={18} weight="duotone" />
              </span>
              <span className="prayer__row-name">
                {p.name} <span className="prayer__row-arabic">{p.arabic}</span>
              </span>
              <span className="prayer__row-athan">{p.athan}</span>
              <span className="prayer__row-iqamah">{p.iqamah}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}