"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_PROGRAM, type ProgramCode } from "@/data";
import { catalogFor } from "@/components/finder/catalog";
import { studentFor } from "./student";

/*
 * The signed-in program for client components. The server reads the cookie and hands the
 * code down; everything else (record, tree, finder model) is derived here from @/data.
 * Outside a provider (the /components workbench) it is Rafiat's, as before.
 */
const ProgramContext = createContext<ProgramCode>(DEFAULT_PROGRAM);

export function StudentProvider({ program, children }: { program: ProgramCode; children: ReactNode }) {
  return <ProgramContext value={program}>{children}</ProgramContext>;
}

export function useProgram() {
  return useContext(ProgramContext);
}

export function useStudent() {
  const program = useProgram();
  return useMemo(() => studentFor(program), [program]);
}

/* The finder model for the signed-in program, built once per program (see catalogFor). */
export function useCatalog() {
  return catalogFor(useProgram());
}
