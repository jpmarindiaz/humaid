import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT = 768;

/** Tracks whether the viewport is below md: (768px) — i.e. phone-shaped. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.innerWidth < MOBILE_BREAKPOINT
      : false
  );

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isMobile;
}
