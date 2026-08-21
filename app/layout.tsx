import type { Metadata } from "next";
import { Big_Shoulders, Newsreader, IBM_Plex_Mono, Barlow_Condensed, Public_Sans } from "next/font/google";
import "./globals.css";
import "./v5.css";
import "./styles/v5-lite.css";
import "./styles/v3-show.css";
import "./styles/v3-notebook.css";
import "./styles/v3-poll.css";
import "./styles/v3-recruiting.css";
import "./styles/v3-community.css";
import "./styles/v3-play.css";
import "./styles/v3-wire-story.css";
import RhythmBar from "@/components/chrome/RhythmBar";
import Masthead from "@/components/chrome/Masthead";
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
// v5 design-layer fonts (chrome + homepage); interior pages keep the trio above.
const v5cond = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--v5-cond-f",
});
const v5sans = Public_Sans({ subsets: ["latin"], weight: "variable", variable: "--v5-sans-f" });

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
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable} ${v5cond.variable} ${v5sans.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SITE_JSON_LD).replace(/</g, "\\u003c") }}
        />
        <RhythmBar />
        <Masthead />
        {children}
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
