import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://meow-wild.vercel.app"),
  title: "meow.wild — how high do cats live?",
  description:
    "Scroll down from the frozen roof of the world to the valley floor, meeting wild cats at the exact altitude they call home. A descent through every cat, by elevation.",
  keywords: [
    "wild cats",
    "big cats",
    "small cats",
    "snow leopard",
    "altitude",
    "nature",
    "scroll story",
  ],
  authors: [{ name: "meow.wild" }],
  openGraph: {
    title: "meow.wild — how high do cats live?",
    description:
      "A scroll down the mountain, from the snow leopard at 5,000 m to the cat asleep in your lap.",
    type: "website",
    siteName: "meow.wild",
  },
  twitter: {
    card: "summary_large_image",
    title: "meow.wild — how high do cats live?",
    description:
      "A scroll down the mountain, from the snow leopard at 5,000 m to the cat asleep in your lap.",
  },
};

export const viewport: Viewport = {
  themeColor: "#c2d6e3",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
