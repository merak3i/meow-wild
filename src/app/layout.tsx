import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

/* Self-hosted (SIL OFL 1.1, see fonts/OFL.txt): no build-time call to Google Fonts. */
const serif = localFont({
  src: [
    { path: "./fonts/InstrumentSerif-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/InstrumentSerif-Italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-serif",
  display: "swap",
});

const sans = localFont({
  src: "./fonts/InstrumentSans-Variable.woff2",
  weight: "400 700",
  variable: "--font-sans",
  display: "swap",
});

const mono = localFont({
  src: "./fonts/JetBrainsMono-Variable.woff2",
  weight: "100 800",
  variable: "--font-mono",
  display: "swap",
});

const TITLE = "meow.wild · How high does a cat live?";
const DESCRIPTION =
  "Scroll down from the frozen roof of the world to the sea, meeting 18 wild cats at the altitude each one calls home. One day, one mountain, every landscape drawn live as you descend.";
const SHARE = "A scroll down the mountain, from the snow leopard at 5,000 m to the cat asleep in your lap.";

export const metadata: Metadata = {
  metadataBase: new URL("https://meow-wild.vercel.app"),
  title: TITLE,
  description: DESCRIPTION,
  keywords: ["wild cats", "big cats", "small cats", "snow leopard", "altitude", "nature", "scroll story", "Meow Creative Haus"],
  authors: [{ name: "Meow Creative Haus", url: "https://meowcreativehaus.xyz" }],
  creator: "Meow Creative Haus",
  openGraph: {
    title: TITLE,
    description: SHARE,
    type: "website",
    siteName: "meow.wild",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: SHARE,
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1226",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/* Runs before first paint: flags JS, reduced motion and WebGL2 so CSS can stage the reveal without a flash. */
const BOOT = `(function(){var d=document.documentElement;d.classList.add('js');try{if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)d.classList.add('rm');var c=document.createElement('canvas');if(c.getContext('webgl2'))d.classList.add('gl')}catch(e){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
