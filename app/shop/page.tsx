import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import PreseasonChip from "@/components/PreseasonChip";

export const metadata: Metadata = {
  title: "The State Store",
  description: "Wear the flag — tees, hats, and Quad gear from The Pate State.",
  alternates: { canonical: "/shop" },
};

// --- Preseason-preview sample data ---------------------------------------
// Stands in for the real shelf (prices, gear list). The State Store already
// exists at patestatematerial.com — every product CTA and tile below routes
// there in a new tab per the brief rather than faking a cart on this
// domain (the Pate Report tile is the one exception: it's an internal
// editorial product with its own real page at /report). Note: the
// wireframe's Pate Report cover art (pate-report-cover.svg) doesn't exist
// as an asset anywhere in wireframes/ or public/ — same gap already flagged
// on /report — so it's rendered here as a styled placeholder box instead of
// a broken <img> tag.

const STORE_URL = "https://patestatematerial.com";

type GearItem = { label: string; photo: string | null; alt: string | null };

const DEMO_GEAR: readonly GearItem[] = [
  { label: "QUAD FLAG — $34", photo: "/img/product-flag.jpg", alt: "The Pate State Quad flag" },
  { label: "GAMEDAY HAT — $32", photo: "/img/product-hat.jpg", alt: "The Pate State gameday hat" },
  { label: "CITIZEN HOODIE — $54", photo: null, alt: null },
  { label: "TAILGATE APRON — $38", photo: null, alt: null },
  { label: "STRENGTH & CONDITIONING TEE — $28", photo: "/img/product-sc-tee.jpg", alt: "The Pate State Strength & Conditioning tee" },
  { label: "NO OFFSEASON TEE — $28", photo: "/img/product-no-offseason-tee.jpg", alt: "The Pate State No Offseason tee" },
];

export default function ShopPage() {
  return (
    <main className="v5-lite">
      <header className="page-head">
        <div className="wrap">
          <p className="crumb">The Pate State / The State Store</p>
          <h1>The State Store</h1>
          <p className="lede">Wear the flag. Fly the colors. Every order funds more Quad.</p>
          <span className="note">Preseason preview — orders run through patestatematerial.com until the State Store opens</span>
        </div>
      </header>

      <section>
        <div className="wrap">
          <p style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--ink-dim)", marginBottom: 28 }}>
            The State Store lives at patestatematerial.com while this shelf is under construction.
          </p>
          <p className="eyebrow">The Flagship</p>
          <div className="duo" style={{ alignItems: "center" }}>
            <div style={{ background: "var(--paper-2)", border: "1px solid var(--line-l)", borderRadius: 6, padding: 20 }}>
              <svg className="tee-svg" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
                <title>The Creed Tee, field green with a vintage train-and-football chest print</title>
                <defs>
                  <clipPath id="teeGraphicClip">
                    <rect x="106" y="96" width="88" height="60" rx="4" />
                  </clipPath>
                </defs>
                <path
                  d="M96,38 L120,26 C128,40 172,40 180,26 L204,38 L246,64 L226,104 L204,92 L204,262 C204,270 198,274 190,274 L110,274 C102,274 96,270 96,262 L96,92 L74,104 L54,64 Z"
                  fill="#1E3B2E"
                />
                <path
                  d="M120,26 C128,40 172,40 180,26 L204,38 C188,54 112,54 96,38 Z"
                  fill="rgba(0,0,0,.25)"
                />
                <text x="150" y="88" textAnchor="middle" fontFamily="Georgia,serif" fontStyle="italic" fontSize="20" fill="#E8A33D">No</text>
                <image
                  href="/img/train-tee.jpg"
                  x="106"
                  y="96"
                  width="88"
                  height="60"
                  preserveAspectRatio="xMidYMid slice"
                  clipPath="url(#teeGraphicClip)"
                />
                <rect x="106" y="96" width="88" height="60" rx="4" fill="none" stroke="rgba(243,239,230,.25)" strokeWidth="1" />
                <text x="150" y="180" textAnchor="middle" fontFamily="Arial Black,sans-serif" fontWeight="900" fontSize="15" fill="#F3EFE6" letterSpacing="1.5">OFFSEASON</text>
                <line x1="116" y1="194" x2="184" y2="194" stroke="#F3EFE6" strokeWidth="1.5" />
                <text x="150" y="212" textAnchor="middle" fontFamily="monospace" fontSize="7.5" fill="#B9B4A6" letterSpacing="2.5">EST. THE PATE STATE</text>
              </svg>
            </div>
            <div>
              <h2 className="display" style={{ fontSize: 44 }}>The Creed Tee</h2>
              <p className="lede">
                Two words, year-round. Tri-blend and ridiculously soft — field green with stadium-light gold. The
                shirt of the State.
              </p>
              <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a className="btn solid" href={STORE_URL} target="_blank" rel="noopener">Get It at the State Store — $28</a>
                <a className="btn" href={STORE_URL} target="_blank" rel="noopener">See All Colors</a>
              </div>
            </div>
          </div>

          <p className="eyebrow" style={{ marginTop: 44 }}>Gear</p>
          <div className="shop-items shop4" style={{ marginTop: 12 }}>
            {DEMO_GEAR.map((g) => (
              <a className={g.photo ? "item has-photo" : "item"} href={STORE_URL} target="_blank" rel="noopener" style={{ textDecoration: "none" }} key={g.label}>
                {g.photo && (
                  <>
                    <Image src={g.photo} alt={g.alt ?? g.label} fill sizes="(max-width: 700px) 50vw, 260px" style={{ objectFit: "cover" }} />
                    <div className="item-scrim" />
                  </>
                )}
                <div style={{ flex: 1 }} />
                <b>{g.label}</b>
              </a>
            ))}
          </div>

          <p className="eyebrow" style={{ marginTop: 28 }}>Paper &amp; Pennants</p>
          <div className="shop-items shop4" style={{ marginTop: 12 }}>
            <Link href="/report" className="item has-photo" style={{ textDecoration: "none" }}>
              <Image
                src="/img/editorial-goalpost.jpg"
                alt="A goalpost silhouetted in fog against the sunrise"
                fill
                sizes="(max-width: 700px) 50vw, 260px"
                style={{ objectFit: "cover" }}
              />
              <div className="item-scrim" />
              <div style={{ flex: 1 }} />
              <b>THE PATE REPORT — $24.99 · DIGITAL FREE FOR CITIZENS</b>
            </Link>
            <a className="item" href={STORE_URL} target="_blank" rel="noopener" style={{ textDecoration: "none" }}><div style={{ flex: 1 }} /><b>STADIUM PASSPORT — $19</b></a>
            <a className="item" href={STORE_URL} target="_blank" rel="noopener" style={{ textDecoration: "none" }}><div style={{ flex: 1 }} /><b>POLL DAY MUG — $22</b></a>
            <a className="item" href={STORE_URL} target="_blank" rel="noopener" style={{ textDecoration: "none" }}><div style={{ flex: 1 }} /><b>WALL OF CHAMPIONS PRINT — $29</b></a>
          </div>
          <p style={{ marginTop: 24, fontSize: 15, color: "var(--ink-dim)" }}>
            Citizens get free shipping, always. Pick&apos;em champions shop free for a year.
          </p>
        </div>
      </section>

      <div className="cta-band">
        <div className="wrap row">
          <div>
            <h3>Who&apos;s In? See the Playoff Picture.</h3>
            <p>THE BRACKET, THE RANKINGS, JOSH&apos;S PICKS — AND AN AI TO RUN YOUR OWN</p>
          </div>
          <Link href="/playoffs" className="btn" style={{ borderColor: "var(--lamp)", color: "var(--lamp)" }}>
            Open the Playoffs Page →
          </Link>
        </div>
      </div>
    </main>
  );
}
