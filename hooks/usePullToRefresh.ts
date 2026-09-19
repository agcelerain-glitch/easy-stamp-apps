"use client";

import { useState, useRef, useEffect } from "react";

interface Options {
  onRefresh: () => Promise<void>;
  threshold?: number; // px（デフォルト 60）
}

export interface PullState {
  progress: number;      // 0〜1 引っ張り進捗
  isRefreshing: boolean;
  isPulling: boolean;
}

export function usePullToRefresh({ onRefresh, threshold = 60 }: Options): PullState {
  const [state, setState] = useState<PullState>({
    progress: 0,
    isRefreshing: false,
    isPulling: false,
  });

  // stale closure を避けるため callback は ref で持つ
  const refreshRef   = useRef(onRefresh);
  const isActiveRef  = useRef(false); // 現在 refresh 中か
  const startYRef    = useRef(0);
  const pullingRef   = useRef(false);
  const distRef      = useRef(0);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      // スクロール位置が最上部のときだけ有効
      if (window.scrollY > 2 || isActiveRef.current) return;
      startYRef.current = e.touches[0].clientY;
      pullingRef.current = true;
    }

    function onTouchMove(e: TouchEvent) {
      if (!pullingRef.current) return;
      const raw = e.touches[0].clientY - startYRef.current;
      if (raw <= 0) {
        distRef.current = 0;
        setState((s) => ({ ...s, progress: 0, isPulling: false }));
        return;
      }
      // ゴム的な抵抗感: √distance でダンピング
      const dampened = Math.min(threshold * 1.3, Math.sqrt(raw) * 6);
      distRef.current = dampened;
      setState({
        progress: Math.min(1, dampened / threshold),
        isRefreshing: false,
        isPulling: true,
      });
    }

    async function onTouchEnd() {
      if (!pullingRef.current) return;
      pullingRef.current = false;
      const dist = distRef.current;
      distRef.current = 0;

      if (dist >= threshold * 0.85) {
        isActiveRef.current = true;
        setState({ progress: 0, isRefreshing: true, isPulling: false });
        try {
          await refreshRef.current();
        } finally {
          isActiveRef.current = false;
          setState({ progress: 0, isRefreshing: false, isPulling: false });
        }
      } else {
        setState({ progress: 0, isRefreshing: false, isPulling: false });
      }
    }

    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove",  onTouchMove,  { passive: true });
    document.addEventListener("touchend",   onTouchEnd,   { passive: true });

    return () => {
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove",  onTouchMove);
      document.removeEventListener("touchend",   onTouchEnd);
    };
  }, [threshold]);

  return state;
}
