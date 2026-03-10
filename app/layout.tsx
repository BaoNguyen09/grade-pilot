import type { Metadata } from "next";
import Script from "next/script";
import {
  Geist,
  Geist_Mono,
  Manrope,
  Space_Grotesk,
  Bricolage_Grotesque,
  Instrument_Serif,
} from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://gp.thienbao.dev"),
  title: "GradePilot",
  description: "Plan your grades, forecast your maximum GPA, and stay on track.",
  openGraph: {
    title: "GradePilot",
    description: "Plan your grades and forecast your GPA.",
    siteName: "GradePilot",
  },
  twitter: {
    card: "summary_large_image",
    title: "GradePilot",
    description: "Plan your grades and forecast your GPA.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <Script id="theme-init" strategy="beforeInteractive">
        {`(function(){var t=localStorage.getItem('gradepilot-theme')||'light';document.documentElement.classList.add(t);})();`}
      </Script>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable} ${spaceGrotesk.variable} ${bricolageGrotesque.variable} ${instrumentSerif.variable} min-h-screen text-foreground bg-background font-sans antialiased transition-colors duration-300`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
