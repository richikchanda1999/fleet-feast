"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { State } from "@/lib/api/types.gen";
import { GameStateOutput, transformStateToGameState } from "../types/dashboard";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface UseGameStateResult {
  gameState: GameStateOutput | null;
  isConnected: boolean;
  error: Error | null;
  reconnect: () => void;
}

export function useGameState(): UseGameStateResult {
  const [gameState, setGameState] = useState<GameStateOutput | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const connect = useCallback(() => {
    // Clean up any existing connection
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const connectSSE = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/events`, {
          signal: abortController.signal,
          headers: {
            Accept: "text/event-stream",
          },
        });

        if (!response.ok) {
          throw new Error(`SSE connection failed: ${response.status}`);
        }

        if (!response.body) {
          throw new Error("No response body");
        }

        setIsConnected(true);
        setError(null);

        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            setIsConnected(false);
            break;
          }

          buffer += value;
          // Normalize line endings
          buffer = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

          // Process complete SSE messages (separated by double newlines)
          const messages = buffer.split("\n\n");
          buffer = messages.pop() ?? "";

          for (const message of messages) {
            if (!message.trim()) continue;

            const lines = message.split("\n");
            const dataLines: string[] = [];

            for (const line of lines) {
              if (line.startsWith("data:")) {
                dataLines.push(line.replace(/^data:\s*/, ""));
              }
            }

            if (dataLines.length > 0) {
              const rawData = dataLines.join("\n");
              try {
                const state: State = JSON.parse(rawData);
                const transformed = transformStateToGameState(state);
                setGameState(transformed);
              } catch (parseError) {
                console.error("Failed to parse SSE data:", parseError);
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Connection was aborted intentionally
          return;
        }

        console.error("SSE connection error:", err);
        setError(err instanceof Error ? err : new Error("Unknown error"));
        setIsConnected(false);

        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (!abortController.signal.aborted) {
            connectSSE();
          }
        }, 3000);
      }
    };

    connectSSE();
  }, []);

  const reconnect = useCallback(() => {
    setError(null);
    connect();
  }, [connect]);

  useEffect(() => {
    connect();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [connect]);

  return {
    gameState,
    isConnected,
    error,
    reconnect,
  };
}
