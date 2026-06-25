"use client";

import { useEffect, useRef } from "react";

export function ScrollToBottom({ dep }: { dep: string | number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  }, [dep]);
  return <div ref={ref} />;
}
