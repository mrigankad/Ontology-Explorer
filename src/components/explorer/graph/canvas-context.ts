"use client";

import { createContext, useContext } from "react";

export interface CanvasActions {
  selectNode: (id: string) => void;
  selectEdge: (id: string) => void;
  openRecord: (id: string) => void;
  toggleBundle: (id: string) => void;
  expand: (id: string) => void;
  hoverBundle: (id: string | null) => void;
}

export const CanvasActionsContext = createContext<CanvasActions>({
  selectNode: () => {},
  selectEdge: () => {},
  openRecord: () => {},
  toggleBundle: () => {},
  expand: () => {},
  hoverBundle: () => {},
});

export const useCanvasActions = () => useContext(CanvasActionsContext);
