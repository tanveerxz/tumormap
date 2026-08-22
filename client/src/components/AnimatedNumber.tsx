"use client";

import { useEffect, useState } from "react";
import { useMotionValueEvent, useReducedMotion, useSpring } from "motion/react";

interface Props {
  value: number;
  format: (value: number) => string;
  className?: string;
}

/**
 * A figure that springs to its new value instead of cutting to it.
 *
 * This is the interruptible case that matters on this page: dragging the pass
 * slider re-runs the simulation continuously, so the metric is re-targeted
 * mid-flight. A spring animates from the current *presentation* value and
 * carries its velocity through the re-target, so the number never jumps and
 * never has to finish one animation before starting the next.
 *
 * Critically damped by default (bounce 0) — nothing here was thrown by the
 * user, and overshoot on a settling statistic reads as noise.
 */
export default function AnimatedNumber({ value, format, className }: Props) {
  const reducedMotion = useReducedMotion();
  const spring = useSpring(value, { bounce: 0, duration: 0.45 });
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    // jump() sets without animating — the non-vestibular equivalent.
    if (reducedMotion) spring.jump(value);
    else spring.set(value);
  }, [value, spring, reducedMotion]);

  useMotionValueEvent(spring, "change", (latest) => setDisplay(latest));

  return (
    <span className={className} suppressHydrationWarning>
      {format(display)}
    </span>
  );
}
