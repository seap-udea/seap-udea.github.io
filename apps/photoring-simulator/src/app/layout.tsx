import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://seap-udea.github.io"),
  title: "PRisma Simulator: PhotoRing Effect Simulator",
  description:
    "Interactive simulator for exploring how planetary rings alter transit light curves and inferred stellar density.",
  openGraph: {
    type: "website",
    url: "https://seap-udea.github.io/apps/photoring-simulator/",
    title: "PRisma Simulator: PhotoRing Effect Simulator",
    description:
      "Explore how exoplanetary rings alter transit light curves and inferred stellar density.",
    images: [
      {
        url: "/apps/photoring-simulator/photoring-simulator-screenshot.webp",
        width: 1013,
        height: 869,
        alt: "PhotoRing Effect Simulator screenshot",
        type: "image/webp",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PRisma Simulator: PhotoRing Effect Simulator",
    description:
      "Explore how exoplanetary rings alter transit light curves and inferred stellar density.",
    images: ["/apps/photoring-simulator/photoring-simulator-screenshot.webp"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
