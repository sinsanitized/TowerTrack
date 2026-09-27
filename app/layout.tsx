import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TowerTrack",
  description: "Legionella-first cooling tower compliance date tracking",
};

const themeScript = `
  (function () {
    try {
      var theme = localStorage.getItem("towertrack-theme");
      if (theme !== "light" && theme !== "dark") {
        theme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
      document.documentElement.dataset.theme = theme;
    } catch (_) {
      document.documentElement.dataset.theme = "light";
    }
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
