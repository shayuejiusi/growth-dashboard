import { create } from "zustand"
import { persist } from "zustand/middleware"

export type Theme = "light" | "dark"

interface UiState {
  theme: Theme
  sidebarCollapsed: boolean
  toggleTheme: () => void
  toggleSidebar: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: "light",
      sidebarCollapsed: false,
      toggleTheme: () => set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    }),
    {
      name: "dashboard-ui",
      partialize: (state) => ({
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
)
