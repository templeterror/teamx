import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  axes: ["opsz"],
  variable: "--font-display",
});

/* White mode only (productthink.md), so one color scheme. No zoom limits, ever. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
  colorScheme: "light",
};

export const metadata: Metadata = {
  title: "Course Planner",
  description: "A semester plan that is already mostly filled.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.className} ${sourceSerif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
