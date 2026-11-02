import type { Metadata } from "next";
import { TermPicker } from "./term-picker";

export const metadata: Metadata = {
  title: "Select a term · Course Planner",
};

export default function TermPage() {
  return <TermPicker />;
}
