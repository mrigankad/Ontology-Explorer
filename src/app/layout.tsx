import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./explorer.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wayam Ontology Explorer",
  description: "Explore Wayam's products, capabilities and industries, and trace every relationship to the records behind it.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#101010" },
  ],
};

// Fallback for when the cookie is missing but localStorage has a choice.
const THEME_BOOT = `try{var d=document.documentElement;if(!d.dataset.theme){var t=localStorage.getItem("wayam-theme");if(t==="light"||t==="dark")d.dataset.theme=t}}catch(e){}`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Explicit choice from the cookie; without one, CSS follows the system theme.
  const saved = (await cookies()).get("wayam-theme")?.value;
  const theme = saved === "light" || saved === "dark" ? saved : undefined;
  return (
    <html lang="en" data-theme={theme} className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply a saved theme before first paint so there is no flash of the wrong theme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
