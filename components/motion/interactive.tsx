"use client";

import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

/** True if the primary pointer is coarse (touch) — used to disable cursor-driven effects there. */
function useIsCoarsePointer(): boolean {
  // Lazy initializer reads the real value on first client render instead
  // of syncing it via setState inside an effect; the effect below only
  // subscribes to further changes (e.g. a hybrid device switching input).
  const [coarse, setCoarse] = useState(() => (typeof window === "undefined" ? false : window.matchMedia("(pointer: coarse)").matches));
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const listener = (e: MediaQueryListEvent) => setCoarse(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);
  return coarse;
}

/**
 * A button that subtly pulls toward the cursor as it approaches, and
 * springs back on leave. Skipped entirely on touch devices and when
 * reduced motion is requested — the button is a plain, fully-functional
 * button in both cases, just without the cursor effect.
 */
type NativeButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onAnimationStart" | "onAnimationEnd" | "onDrag" | "onDragStart" | "onDragEnd"
>;

export function MagneticButton({
  children,
  className,
  strength = 0.35,
  ...props
}: NativeButtonProps & { strength?: number }) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const coarse = useIsCoarsePointer();
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 300, damping: 20, mass: 0.4 });
  const disabled = coarse || reduce;

  function handleMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (disabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    x.set((e.clientX - (rect.left + rect.width / 2)) * strength);
    y.set((e.clientY - (rect.top + rect.height / 2)) * strength);
  }
  function handleLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.button
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      style={disabled ? undefined : { x: springX, y: springY }}
      whileHover={disabled ? undefined : { scale: 1.03, filter: "brightness(1.08)" }}
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={className}
      {...props}
    >
      {children}
    </motion.button>
  );
}

/**
 * Subtle 3D pointer-tilt on a card, plus a light shadow lift. Disabled on
 * touch devices and under reduced motion (renders as a static card).
 */
export function TiltCard({
  children,
  className,
  max = 4,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const coarse = useIsCoarsePointer();
  const reduce = useReducedMotion();
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  // Slightly under-damped-critical spring: settles smoothly back to
  // neutral with no overshoot wobble, which is what keeps a small tilt
  // feeling premium rather than gimmicky.
  const springRX = useSpring(rotateX, { stiffness: 180, damping: 26, mass: 0.5 });
  const springRY = useSpring(rotateY, { stiffness: 180, damping: 26, mass: 0.5 });
  const disabled = coarse || reduce;

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * max * 2);
    rotateX.set(-py * max * 2);
  }
  function handleLeave() {
    rotateX.set(0);
    rotateY.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      style={disabled ? undefined : { rotateX: springRX, rotateY: springRY, transformPerspective: 800 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * A soft radial highlight that follows the cursor over a card, plus a
 * subtle border/lift reaction — all CSS-driven (a custom property update
 * on pointermove, no React re-render per mouse move) so it stays cheap
 * even on a grid of many cards. Disabled on touch/coarse pointers and
 * under reduced motion, where the card renders as fully static.
 */
export function SpotlightCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const coarse = useIsCoarsePointer();
  const reduce = useReducedMotion();
  const disabled = coarse || reduce;

  function handleMove(e: React.PointerEvent<HTMLDivElement>) {
    if (disabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    ref.current.style.setProperty("--spot-x", `${e.clientX - rect.left}px`);
    ref.current.style.setProperty("--spot-y", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      className={`group/spotlight relative transition-transform duration-300 ${disabled ? "" : "hover:-translate-y-0.5"} ${className ?? ""}`}
    >
      {!disabled && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-300 group-hover/spotlight:opacity-100"
          style={{
            background:
              "radial-gradient(220px circle at var(--spot-x, 50%) var(--spot-y, 50%), rgba(76, 130, 255, 0.14), transparent 70%)",
          }}
        />
      )}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

/**
 * Thin, fixed top-of-page scroll progress bar — deliberately invisible at
 * the very top of the page and only fades in a few percent into the
 * scroll, so it registers as useful wayfinding once the user is actually
 * moving through the story rather than as a UI element competing with
 * the hero.
 */
export function ScrollProgressBar() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 200, damping: 40, restDelta: 0.001 });
  const opacity = useTransform(scrollYProgress, [0, 0.02, 0.04], [0, 0, 1]);

  if (reduce) return null;

  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX, opacity, transformOrigin: "0% 50%" }}
      className="fixed left-0 top-0 z-50 h-[1.5px] w-full bg-mkt-accent/70"
    />
  );
}

/** Maps scroll progress of one element to an output range — thin wrapper so section files don't each re-derive useScroll. */
export function useScrollYProgress(ref: React.RefObject<HTMLElement | null>) {
  return useScroll({ target: ref, offset: ["start end", "end start"] });
}

export { useTransform };
