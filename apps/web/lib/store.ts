import { createStore } from "zustand";
import type { State, Truck, Zone } from "@/lib/api";
import { FleetFeastCity } from "../app/data/FleetFeastCity";

export type GameState = {
  currentTime: integer;
  trucks: Array<Truck>;
  zones: Array<Zone>;
  city: FleetFeastCity | undefined;
};

export type GameActions = {
  handleState(state: State): void;
};

export type GameStore = GameState & GameActions;

export const defaultInitialState: GameState = {
  city: undefined,
  currentTime: 0,
  trucks: [],
  zones: [],
};

export const createGameStore = (initialState: GameState = defaultInitialState) =>
  createStore<GameStore>()((set) => ({
    ...initialState,
    handleState: (state) => {
      set((currentState) => {
        return {
          currentTime: state.current_time ?? 0,
          trucks: state.trucks ?? [],
          zones: state.zones ?? [],
          city: typeof currentState.city !== "undefined" ? currentState.city : new FleetFeastCity(),
        };
      });
    },
  }));
