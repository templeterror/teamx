import type { Metadata } from "next";
import { Workbench } from "@/components/workbench/workbench";

export const metadata: Metadata = {
  title: "Components · Course Planner",
};

export default function ComponentsPage() {
  return <Workbench />;
}
