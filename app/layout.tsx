import type { Metadata } from "next";
import { Big_Shoulders, Newsreader, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import Ticker from "@/components/Ticker";
import Footer from "@/components/Footer";
import { Analytics } from "@vercel/analytics/next";
import { SITE_URL } from "@/lib/site";

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
  metadataBase: new URL(SITE_URL),
};

// Site-wide structured data (v2 brief §8): Organization, WebSite with a
// SearchAction pointing at the real /search route, and the Person entity for
// Josh with sameAs links. Page-specific JSON-LD (NewsArticle, VideoObject,
// BreadcrumbList) lives in each route.
const SITE_JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}#org`,
    name: "The Pate State",
    url: SITE_URL,
    sameAs: [
      "https://www.youtube.com/@JoshPateCFB",
      "https://x.com/JoshPateCFB",
      "https://www.instagram.com/joshpatecfb",
      "https://www.tiktok.com/@joshpatecfb",
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "The Pate State",
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${SITE_URL}/authors/josh-pate#person`,
    name: "Josh Pate",
    url: `${SITE_URL}/authors/josh-pate`,
    jobTitle: "Host, Josh Pate's College Football Show",
    worksFor: { "@id": `${SITE_URL}#org` },
    sameAs: [
      "https://www.youtube.com/@JoshPateCFB",
      "https://x.com/JoshPateCFB",
      "https://www.instagram.com/joshpatecfb",
      "https://open.spotify.com/show/553DKKHsBSCOkrZdppJpeB",
      "https://podcasts.apple.com/us/podcast/josh-pates-college-football-show/id1485905502",
    ],
  },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSON_LD).replace(/</g, "\\u003c") }}
        />
        <Ticker />
        <Nav />
        {children}
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
