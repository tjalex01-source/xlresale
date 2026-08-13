import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, Space_Mono } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const instrument = Instrument_Sans({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "XLResale — garage sales, live",
  description:
    "Find garage, yard, and estate sales near you. See which ones are open right now, and plan a route that reaches them before they close.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    // iOS ignores the manifest's display mode; these are what make it open
    // chrome-less from the home screen, and installing is also the only way
    // Safari will allow web push at all.
    capable: true,
    title: "XLResale",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#ff2e63",
  // Most of this is used one-handed in a car park; let people zoom.
  initialScale: 1,
  width: "device-width",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${instrument.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
