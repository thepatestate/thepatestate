import type { Metadata } from "next";
import { Big_Shoulders, Newsreader, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Ticker from "@/components/Ticker";
import Footer from "@/components/Footer";

// "Big Shoulders Display" was merged into the variable "Big Shoulders" family
// (opsz axis) by Google Fonts; requesting the opsz axis + default optical
// sizing reproduces the chunky Display cut used at the mockup's large sizes.
const display = Big_Shoulders({
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
  variable: "--display",
});
const body = Newsreader({ subsets: ["latin"], style: ["normal", "italic"], variable: "--body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--mono" });

export const metadata: Metadata = {
  title: { default: "The Pate State — The Front Porch of College Football", template: "%s — The Pate State" },
  description:
    "The online home of Josh Pate's College Football Show. New episodes all week, all season. Pull up a chair.",
  metadataBase: new URL("https://thepatestate.vercel.app"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <Ticker />
        <Nav />
        {children}
        <Footer />
      </body>
    </html>
  );
}
