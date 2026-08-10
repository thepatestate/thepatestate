import { type ReactNode } from "react";

/**
 * Formerly a scroll-reveal (fade + rise on first viewport entry). Retired
 * 2026-08-10: on real devices the armed (opacity-0) state could read as
 * blank page regions — the exact "dead space" complaint the client raised —
 * so content now renders visible, always. The wrapper stays so call sites
 * and the .reveal CSS hooks don't churn; re-animate here if that ever
 * changes.
 */
export default function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={className ? `reveal ${className}` : "reveal"}>{children}</div>;
}
