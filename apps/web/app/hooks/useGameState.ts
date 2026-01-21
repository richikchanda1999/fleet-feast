"use client";

import { useState, useEffect, useRef } from "react";
import { State } from "@/lib/api/types.gen";
import { useGameStore } from "@/lib/game-store-provider";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface UseGameStateResult {
  isConnected: boolean;
  error: Error | null;
}

export function useGameState(): UseGameStateResult {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { handleState } = useGameStore((state) => state)

  const eventSource = useRef<EventSource | null>(null);

  useEffect(() => {
    if (eventSource.current !== null) {
      return
    }

    eventSource.current = new EventSource(`${API_BASE_URL}/events`)
    eventSource.current.onopen = (ev) => {
      setIsConnected(true);
    };

    eventSource.current.onerror = (ev) => {
      console.log(ev);
    };

    eventSource.current.onmessage = (ev: MessageEvent) => {
      if (ev.isTrusted) {
        const state: State = JSON.parse(ev.data) as State;
        handleState(state)
      }
    };
  }, [handleState]);

  return {
    isConnected,
    error,
  };
}
