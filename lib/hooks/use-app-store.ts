"use client";

import { create } from "zustand";
import { STORAGE_KEYS } from "@/lib/config";

type AppState = {
  selectedProjectId: string | null;
  hydrated: boolean;
  setSelectedProjectId: (id: string | null) => void;
  hydrate: () => void;
};

export const useAppStore = create<AppState>((set) => ({
  selectedProjectId: null,
  hydrated: false,
  setSelectedProjectId: (id) => {
    set({ selectedProjectId: id });
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(STORAGE_KEYS.selectedProject, id);
      else window.localStorage.removeItem(STORAGE_KEYS.selectedProject);
    }
  },
  hydrate: () => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEYS.selectedProject);
    set({ selectedProjectId: stored, hydrated: true });
  },
}));
