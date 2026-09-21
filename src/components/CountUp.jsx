import { useEffect, useState } from "react";

export default function CountUp({ value = 0, decimals = 0, suffix = "", className = "" }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf, start;
    const dur = 1200;
    const step = (t) => {
      if (!start) start = t;
      const p = Math.min((t - start) / dur, 1);
      setV(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span className={className}>
      {v.toFixed(decimals)}
      {suffix}
    </span>
  );
}
