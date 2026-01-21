'use client'

import { createContext, PropsWithChildren, useContext, useState } from "react";
import { createGameStore, GameStore } from "@/lib/store";
import { useStore } from "zustand";

export type GameStoreApi = ReturnType<typeof createGameStore>;
export const GameContext = createContext<GameStoreApi | undefined>(undefined);

export const GameStoreProvider = ({ children }: PropsWithChildren) => {
  const [store] = useState(() => createGameStore());
  return <GameContext.Provider value={store}>{children}</GameContext.Provider>;
};

export const useGameStore = <T,>(selector: (store: GameStore) => T): T => {
  const gameStoreContext = useContext(GameContext);
  if (!gameStoreContext) {
    throw new Error(`useGameStore must be used within GameStoreProvider`);
  }

  return useStore(gameStoreContext, selector);
};
