// Place licensed Icon Sportswire photos on the site, reversibly (2026-09-02).
//   npx tsx scripts/icon-place.mts --plan .superpowers/icon/plan.json [--dry]
//   npx tsx scripts/icon-place.mts --rollback .superpowers/icon/rollback-<stamp>.json
// plan.json: [{ "id": "8341832", "file": "/path/to/8341832.jpg", "credit": "David J. Griffin/Icon Sportswire",
//              "target": { "kind": "article"|"wireStory", "slug": "..." }
//                      | { "kind": "annual", "slug": "georgia" }                       (the cover art box on page 1)
//                      | { "kind": "art", "category": "atmosphere", "alt": "..." } }] (site-wide picker pool)
// Sanity targets: the previous heroImage/heroCredit go to the rollback file; --rollback restores them.
// Repo targets (annual pages, art pool, public/img/icon/*): plain files —
//   `git checkout -- public/annual public/img/icon lib/editorial-art.ts docs/content` undoes them.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
for (const l of readFileSync(".env.local", "utf8").split("\n")) { const i = l.indexOf("="); if (i > 0 && !l.startsWith("#")) process.env[l.slice(0, i).trim()] ??= l.slice(i + 1).trim().replace(/^"|"$/g, ""); }
const args = process.argv.slice(2);
const opt = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const DRY = args.includes("--dry");
const { writeClient, uploadHeroImage } = await import("../lib/sanity.ts");
mkdirSync(".superpowers/icon", { recursive: true });
mkdirSync("public/img/icon", { recursive: true });

type Rollback = { docId: string; heroImage: unknown; heroCredit?: string };

if (opt("--rollback")) {
  const rb = JSON.parse(readFileSync(opt("--rollback")!, "utf8")) as Rollback[];
  for (const r of rb) {
    const p = writeClient.patch(r.docId);
    if (r.heroImage) p.set({ heroImage: r.heroImage }); else p.unset(["heroImage"]);
    if (r.heroCredit) p.set({ heroCredit: r.heroCredit }); else p.unset(["heroCredit"]);
    if (!DRY) await p.commit();
    console.log("restored", r.docId);
  }
  console.log("Sanity restored. Repo files: git checkout -- public/annual public/img/icon lib/editorial-art.ts docs/content");
  process.exit(0);
}

type Target = { kind: "article" | "wireStory"; slug: string } | { kind: "annual"; slug: string } | { kind: "art"; category: string; alt: string };
type Plan = { id: string; file: string; credit: string; target: Target };
const plan = JSON.parse(readFileSync(opt("--plan")!, "utf8")) as Plan[];
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const rollback: Rollback[] = [];
const coverBox = (id: string, credit: string) => `<div class="heroph" style="background:url('/img/icon/${id}.jpg') center/cover no-repeat"><i>Photo: ${credit}</i>`;
const COVER_RE = /<div class="heroph" style="[^"]*"><i>[^<]*<\/i>/;

for (const it of plan) {
  if (!existsSync(it.file)) { console.log(`MISSING FILE ${it.id}: ${it.file}`); continue; }
  const t = it.target;
  if (t.kind === "article" || t.kind === "wireStory") {
    const doc = await writeClient.fetch<{ _id: string; heroImage?: unknown; heroCredit?: string } | null>(`*[_type==$type && slug.current==$slug][0]{_id, heroImage, heroCredit}`, { type: t.kind, slug: t.slug });
    if (!doc) { console.log(`NO DOC ${t.kind}/${t.slug}`); continue; }
    rollback.push({ docId: doc._id, heroImage: doc.heroImage ?? null, heroCredit: doc.heroCredit });
    if (!DRY) {
      const assetId = await uploadHeroImage(readFileSync(it.file));
      if (!assetId) { console.log(`UPLOAD FAILED ${it.id}`); continue; }
      await writeClient.patch(doc._id).set({ heroImage: { _type: "image", asset: { _type: "reference", _ref: assetId } }, heroCredit: it.credit }).commit();
    }
    console.log(`OK ${t.kind}/${t.slug} <- #${it.id} (${it.credit})`);
  } else if (t.kind === "annual") {
    if (!DRY) copyFileSync(it.file, `public/img/icon/${it.id}.jpg`);
    const p = `public/annual/${t.slug}.html`;
    const html = readFileSync(p, "utf8");
    if (!COVER_RE.test(html)) { console.log(`NO COVER BOX in ${p}`); continue; }
    if (!DRY) {
      writeFileSync(p, html.replace(COVER_RE, coverBox(it.id, it.credit)));
      const d = `docs/content/annual-${t.slug}-2026-sol.html`;
      if (existsSync(d)) writeFileSync(d, readFileSync(d, "utf8").replace(COVER_RE, coverBox(it.id, it.credit)));
    }
    console.log(`OK annual/${t.slug} cover <- #${it.id}  (then rebuild public/img/annual-covers/${t.slug}.jpg from #p1)`);
  } else {
    if (!DRY) copyFileSync(it.file, `public/img/icon/${it.id}.jpg`);
    const p = "lib/editorial-art.ts";
    let src = readFileSync(p, "utf8");
    const web = `/img/icon/${it.id}.jpg`;
    if (!src.includes(web)) {
      src = src.replace(/(const IMG: Record<string, string> = \{\n)/, `$1  "${web}": ${JSON.stringify(`${it.alt} (Photo: ${it.credit})`)},\n`);
      src = src.replace(new RegExp(`(\\n\\s*${t.category}: \\[)`), `$1c("${web}"), `);
      if (!DRY) writeFileSync(p, src);
    }
    console.log(`OK art/${t.category} <- #${it.id}`);
  }
}
const rbPath = `.superpowers/icon/rollback-${stamp}.json`;
writeFileSync(rbPath, JSON.stringify(rollback, null, 1));
console.log(`${DRY ? "DRY RUN - " : ""}rollback file: ${rbPath}`);
