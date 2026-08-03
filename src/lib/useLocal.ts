import { useEffect, useState } from "react";

export function useLocal<T>(key: string, initial: T | (() => T)) {
  const [val, setVal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem("gbm:" + key);
      if (raw) return JSON.parse(raw) as T;
    } catch {}
    return typeof initial === "function" ? (initial as () => T)() : initial;
  });
  useEffect(() => {
    try { localStorage.setItem("gbm:" + key, JSON.stringify(val)); } catch {}
  }, [key, val]);
  return [val, setVal] as const;
}
