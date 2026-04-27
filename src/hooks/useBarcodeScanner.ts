"use client";

import { useEffect, useRef } from "react";

interface UseBarcodeScannerOptions {
  enabled?: boolean;
  minLength?: number;
  maxInterKeyDelayMs?: number;
  idleResetMs?: number;
  pattern?: RegExp;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return (
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT" ||
    target.isContentEditable
  );
}

export function useBarcodeScanner(
  onScan: (value: string) => void,
  {
    enabled = true,
    minLength = 8,
    maxInterKeyDelayMs = 60,
    idleResetMs = 120,
    pattern = /^DL-\d{5}$/i,
  }: UseBarcodeScannerOptions = {}
) {
  const callbackRef = useRef(onScan);
  const bufferRef = useRef("");
  const lastKeyAtRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callbackRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const resetBuffer = () => {
      bufferRef.current = "";
      lastKeyAtRef.current = 0;
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = null;
      }
    };

    const flushIfMatch = () => {
      const candidate = bufferRef.current.trim().toUpperCase();
      if (candidate.length >= minLength && pattern.test(candidate)) {
        callbackRef.current(candidate);
      }
      resetBuffer();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      const now = Date.now();
      if (lastKeyAtRef.current && now - lastKeyAtRef.current > maxInterKeyDelayMs) {
        resetBuffer();
      }

      if (event.key === "Enter") {
        if (bufferRef.current) {
          flushIfMatch();
        }
        return;
      }

      if (event.key.length !== 1) {
        return;
      }

      bufferRef.current += event.key;
      lastKeyAtRef.current = now;

      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }

      idleTimerRef.current = setTimeout(() => {
        flushIfMatch();
      }, idleResetMs);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      resetBuffer();
    };
  }, [enabled, idleResetMs, maxInterKeyDelayMs, minLength, pattern]);
}
