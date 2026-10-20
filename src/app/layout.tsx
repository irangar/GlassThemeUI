import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Liquid Glass — A study in light",
  description:
    "A liquid glass playground. Make it yours with a local image or a custom gradient.",
};

export const viewport: Viewport = {
  themeColor: "#252628",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      {/* Extensions such as Grammarly can add body attributes before hydration. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
