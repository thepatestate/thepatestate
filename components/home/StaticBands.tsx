import Link from "next/link";
import Image from "next/image";
import { CHANNEL_URL, SOCIAL_LINKS } from "@/lib/youtube";
import { teamLogoUrl } from "@/lib/teams-meta";

// v5 static bands: Store, Campus, Tailgate, Gift, Follow, Playoffs ribbon.
// Pure markup over existing assets/links — no state, so they share one file.

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

export function CampusSection() {
  return (
    <section className="campus">
      <div className="wrap">
        <div>
          <div className="eyebrow">The Porch Goes On the Road</div>
          <h2>Live &amp; On Campus</h2>
          <span className="badge">Campus stops being booked now · Dates soon</span>
          <p>The broadcast desk, on a quad near you. Citizens get first dibs the moment tickets drop.</p>
          <Link className="primary" href="/join">Join Free for First Access →</Link>
        </div>
        <div className="photo">
          <Image
            src="/img/campus-live.jpg"
            alt="The Pate State broadcast desk live on a college quad"
            fill
            sizes="(max-width:760px) 100vw, 560px"
            style={{ objectFit: "cover" }}
          />
        </div>
      </div>
    </section>
  );
}

const GUIDES = [
  { venue: "Tiger Stadium", k: "LSU · Night Game Survival", team: "lsu" },
  { venue: "The Grove", k: "Ole Miss · Masterclass", team: "ole-miss" },
  { venue: "The Horseshoe", k: "Ohio State · First-Timer", team: "ohio-state" },
  { venue: "Camp Randall", k: "Wisconsin · Jump Around", team: "wisconsin" },
];

export function TailgateSection() {
  return (
    <section className="tailgate">
      <div className="wrap">
        <div className="sect-head">
          <div>
            <div className="eyebrow">Every Stadium · Every Tradition · Every Tailgate</div>
            <h2>Pate Tailgate</h2>
          </div>
          <Link className="more" href="/tailgate">Full Guide — 136 Stadiums →</Link>
        </div>
        <div className="tg-grid">
          {GUIDES.map((g) => {
            const logo = teamLogoUrl(g.team);
            return (
              <Link className="tg" href="/tailgate" key={g.venue}>
                {logo && <Image src={logo} alt="" width={60} height={60} />}
                <div className="venue">{g.venue}</div>
                <div className="k">{g.k}</div>
              </Link>
            );
          })}
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
        <div className="eyebrow">Follow the Porch Everywhere</div>
        <h2>Wherever You Watch, We&apos;re There.</h2>
        <div className="socials">
          <a className="soc yt" href={CHANNEL_URL} target="_blank" rel="noopener">▶ YouTube{subs ? ` · ${subs}` : ""}</a>
          <a className="soc x" href={SOCIAL_LINKS.x} target="_blank" rel="noopener">𝕏 @JoshPateCFB</a>
          <a className="soc ig" href={SOCIAL_LINKS.instagram} target="_blank" rel="noopener">◉ Instagram</a>
          <a className="soc tt" href={SOCIAL_LINKS.tiktok} target="_blank" rel="noopener">♪ TikTok</a>
        </div>
      </div>
    </section>
  );
}

export function PlayoffsRibbon() {
  return (
    <div className="playoffs">
      <div className="wrap">
        <div className="band">
          <span className="tro">🏆</span>
          <div>
            <h3>Who&apos;s In? See the Playoff Picture.</h3>
            <p>The bracket, the rankings, Josh&apos;s picks — and an AI to run your own</p>
          </div>
          <Link className="btn" href="/playoffs">Open the Playoffs Page →</Link>
        </div>
      </div>
    </div>
  );
}
