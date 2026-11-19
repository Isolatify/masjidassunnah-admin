"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_OPTIONS: IntersectionObserverInit = {
  threshold: 0.15,
  rootMargin: "0px 0px -8% 0px",
};

function useInView() {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    if (typeof IntersectionObserver === "undefined") {
      /* No observer available — reveal on the next tick rather than
         synchronously inside the effect (which would cascade a render). */
      const id = window.setTimeout(() => setInView(true), 0);
      return () => window.clearTimeout(id);
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.unobserve(entry.target);
        }
      },
      DEFAULT_OPTIONS
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, inView };
}

/** Pointer-tracked 3D tilt via CSS custom properties (no re-renders). */
function useTilt(
  ref: React.RefObject<HTMLElement | null>,
  enabled = true,
  max = 7
) {
  useEffect(() => {
    if (!enabled) return undefined;
    const el = ref.current;
    if (!el) return undefined;

    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduce.matches) return undefined;

    const set = (x: number, y: number, mx: string, my: string) => {
      el.style.setProperty("--tilt-x", `${x.toFixed(2)}deg`);
      el.style.setProperty("--tilt-y", `${y.toFixed(2)}deg`);
      el.style.setProperty("--tilt-mx", mx);
      el.style.setProperty("--tilt-my", my);
    };

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      set(
        (0.5 - py) * max * 2,
        (px - 0.5) * max * 2,
        `${(px * 100).toFixed(1)}%`,
        `${(py * 100).toFixed(1)}%`
      );
    };

    const onLeave = () => set(0, 0, "50%", "50%");

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [ref, enabled, max]);
}

interface RevealProps extends React.HTMLAttributes<HTMLElement> {
  as?: React.ElementType;
  delay?: number;
  tilt?: boolean;
  tiltMax?: number;
}

export default function Reveal({
  as: Tag = "div",
  children,
  className = "",
  delay = 0,
  tilt = false,
  tiltMax = 7,
  ...rest
}: RevealProps) {
  const { ref: viewRef, inView } = useInView();
  const selfRef = useRef<HTMLElement | null>(null);

  // One element, two consumers: the IntersectionObserver and the tilt hook.
  const setRef = useCallback(
    (node: HTMLElement | null) => {
      selfRef.current = node;
      viewRef.current = node;
    },
    [viewRef]
  );

  useTilt(selfRef, tilt, tiltMax);

  return (
    <Tag
      ref={setRef}
      className={`reveal ${inView ? "is-visible" : ""} ${tilt ? "tilt" : ""} ${className}`}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
