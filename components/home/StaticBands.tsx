import Link from "next/link";
import Image from "next/image";
import { CHANNEL_URL, SOCIAL_LINKS } from "@/lib/youtube";
import { teamLogoUrl } from "@/lib/teams-meta";

// v25 static bands: College Football Life (tailgate + tour), Store, Gift,
// and the compact Follow bar. Pure markup over existing assets/links.

const GUIDES = [
  { venue: "Tiger Stadium", k: "LSU · Night Game Survival", team: "lsu", photo: "p1" },
  { venue: "The Grove", k: "Ole Miss · Masterclass", team: "ole-miss", photo: "p2" },
  { venue: "The Horseshoe", k: "Ohio State · First-Timer", team: "ohio-state", photo: "p3" },
  { venue: "Camp Randall", k: "Wisconsin · Jump Around", team: "wisconsin", photo: "p4" },
];

// The Preseason Annuals band (Isaac, 2026-08-30: "hide the tailgating stadium
// thing, but put the top 5 teams' preseason guides in their place"). JP's top
// five = the published bracket's top seeds (lib/josh-bracket.ts). Each card
// opens the team's Team Capsule, served as a standalone magazine page from
// public/annual/<slug>.html. Cards use the studio helmet photos.
const ANNUALS = [
  { slug: "georgia", name: "Georgia", seed: 1, k: "Josh's No. 1 · The Team Capsule" },
  { slug: "ohio-state", name: "Ohio State", seed: 2, k: "Josh's No. 2 · The Team Capsule" },
  { slug: "clemson", name: "Clemson", seed: 3, k: "Josh's No. 3 · The Team Capsule" },
  { slug: "boise-state", name: "Boise State", seed: 4, k: "Josh's No. 4 · The Team Capsule" },
  { slug: "texas", name: "Texas", seed: 5, k: "Josh's No. 5 · The Team Capsule" },
];

export function AnnualsSection() {
  return (
    <section className="cfl annuals">
      <div className="wrap">
        <div className="sect-head">
          <div>
            <div className="eyebrow">The Preseason Annuals · JP&apos;s Top Five</div>
            <h2>The Case for the Top Teams</h2>
          </div>
          <Link className="more" href="/poll#bracket">Josh&apos;s Bracket — All 12 Seeds →</Link>
        </div>
        <div className="tg-grid an-grid">
          {ANNUALS.map((a) => {
            return (
              // The card shows the guide itself — a render of its cover page —
              // not a helmet (Isaac, 2026-09-02: the helmet "doesn't do a good
              // job communicating that there is a downloadable guide"). Covers
              // are built by scripts/annual-covers (Playwright render of
              // public/annual/<slug>.html #p1) into /img/annual-covers/.
              <a className="tg photo guide" href={`/annual/${a.slug}.html`} key={a.slug}>
                <span className="tg-cover" style={{ backgroundImage: `url(/img/annual-covers/${a.slug}.jpg)` }} />
                <span className="seed">No. {a.seed}</span>
                <div className="venue">{a.name}</div>
                <div className="k">Preseason Annual · Read the Guide →</div>
              </a>
            );
          })}
        </div>
        <div className="tour">
          <div className="copy">
            <div className="eyebrow">The Porch Goes On the Road</div>
            <h3>Live &amp; On Campus</h3>
            <span className="badge">The 2026 Tour Is Taking Shape · Dates Soon</span>
            <p>The broadcast desk, on a quad near you. Citizens get first dibs the moment tickets drop.</p>
            <Link className="go" href="/join">Get First Access →</Link>
          </div>
          <div className="photo">
            <Image src="/img/campus-live.jpg" alt="The Pate State broadcast desk live on campus" fill sizes="(max-width:1080px) 0px, 520px" style={{ objectFit: "cover" }} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** The tailgate band, hidden from the homepage 2026-08-30 (the cards led to
 * demo content). Kept so it can return when /tailgate has real guides. */
export function CFLSection() {
  return (
    <section className="cfl">
      <div className="wrap">
        <div className="sect-head">
          <div>
            <div className="eyebrow">Every Stadium · Every Tradition · Every Tailgate</div>
            <h2>College Football Life</h2>
          </div>
          <Link className="more" href="/tailgate">Full Tailgate Guide — 136 Stadiums →</Link>
        </div>
        {/* PHOTO SLOTS: the four tailgate photos already used on /tailgate (2026-08-30);
            licensed stadium photography (portrait, ~3:3.8) — swap via CSS
            background-image when the photo set lands. */}
        <div className="tg-grid">
          {GUIDES.map((g) => {
            const logo = teamLogoUrl(g.team);
            return (
              <Link className="tg photo" href="/tailgate" key={g.venue}>
                <span className={`tg-photo ${g.photo}`} />
                {logo && <Image className="chip" src={logo} alt="" width={38} height={38} />}
                <div className="venue">{g.venue}</div>
                <div className="k">{g.k}</div>
              </Link>
            );
          })}
        </div>
        <div className="tour">
          <div className="copy">
            <div className="eyebrow">The Porch Goes On the Road</div>
            <h3>Live &amp; On Campus</h3>
            <span className="badge">The 2026 Tour Is Taking Shape · Dates Soon</span>
            <p>The broadcast desk, on a quad near you. Citizens get first dibs the moment tickets drop.</p>
            <Link className="go" href="/join">Get First Access →</Link>
          </div>
          <div className="photo">
            <Image
              src="/img/campus-live.jpg"
              alt="The Pate State broadcast desk live on campus"
              fill
              sizes="(max-width:1080px) 0px, 520px"
              style={{ objectFit: "cover" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

const PRODUCTS = [
  { name: "The Creed Tee · Tri-Blend", price: "$28", photo: "/img/product-tee.jpg", alt: "The Creed Tee, folded flat" },
  { name: "Porch Flag", price: "$34", photo: "/img/product-flag.jpg", alt: "The Pate State porch flag" },
  { name: "Gameday Hat", price: "$32", photo: "/img/product-hat.jpg", alt: "The Pate State gameday hat" },
];

export function StoreSection() {
  return (
    <section className="store">
      <div className="wrap">
        <div className="sect-head">
          <div>
            <div className="eyebrow">Wear the Flag</div>
            <h2>The State Store</h2>
          </div>
          <Link className="more" href="/shop">Shop Everything →</Link>
        </div>
        <div className="store-grid">
          {PRODUCTS.map((p) => (
            <Link className="prod" href="/shop" key={p.name}>
              <div className="ph">
                <Image src={p.photo} alt={p.alt} fill sizes="(max-width:760px) 100vw, 400px" style={{ objectFit: "cover" }} />
              </div>
              <div className="info"><h4>{p.name}</h4><span className="pr">{p.price}</span></div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function GiftSection() {
  return (
    <section className="gift">
      <div className="wrap">
        <div className="cover">
          <Image src="/citizen-gift-cover.png" alt="The 2026 JP Preseason Football Guide cover" width={280} height={350} />
        </div>
        <div>
          <div className="eyebrow">🎁 The Citizen Gift · Free the Moment You Join</div>
          <h2>Become a Citizen, Get the Guide.</h2>
          <p>
            The 2026 JP Preseason Football Guide — the Top 50 ranked, analyzed, and explained, the playoff
            picture, the X-factors, and the breakout players — yours free (digital edition) the moment you
            claim citizenship.
          </p>
          <Link className="primary" href="/join">Claim Free Citizenship</Link>
          <Link className="ghost" href="/report">Peek Inside the Guide</Link>
        </div>
      </div>
    </section>
  );
}

export function FollowSection({ subs }: { subs?: string }) {
  return (
    <section className="follow">
      <div className="wrap">
        <h2>Follow the Porch Everywhere</h2>
        <a className="soc yt" href={CHANNEL_URL} target="_blank" rel="noopener">▶ YouTube{subs ? ` · ${subs}` : ""}</a>
        <a className="soc x" href={SOCIAL_LINKS.x} target="_blank" rel="noopener">𝕏 @JoshPateCFB</a>
        <a className="soc ig" href={SOCIAL_LINKS.instagram} target="_blank" rel="noopener">◉ Instagram</a>
        <a className="soc tt" href={SOCIAL_LINKS.tiktok} target="_blank" rel="noopener">♪ TikTok</a>
      </div>
    </section>
  );
}
