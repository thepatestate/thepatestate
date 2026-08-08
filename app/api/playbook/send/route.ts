import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/cron-auth";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { readClient, getPublishedArticles } from "@/lib/sanity";
import { draftPlaybookIntro } from "@/lib/generate";
import { signUid, hasSigningKey, renderPlaybookHtml, renderPlaybookText, type PlaybookContent } from "@/lib/playbook";
import { SITE_URL } from "@/lib/site";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

const FROM = "The Pate State <porch@thepatestate.com>";
const LISTUSERS_PAGE_SIZE = 1000;

interface Recipient {
  id: string;
  email: string;
}

export async function POST(request: Request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  if (!isAdminConfigured) {
    console.error("[playbook] admin client not configured");
    return NextResponse.json({ ok: true, skipped: "not-configured" });
  }

  const admin = createAdminClient();
  // ET calendar date — the send is a once-a-day event on Josh's clock, not UTC's.
  const sendDate = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

  // Idempotency claim: the send_date primary key makes this insert atomic
  // across concurrent invocations, so only one caller ever proceeds past it.
  const { error: claimError } = await admin.from("playbook_sends").insert({ send_date: sendDate });
  if (claimError) {
    if (claimError.code === "23505") {
      return NextResponse.json({ ok: true, skipped: "already-sent" });
    }
    console.error("[playbook] claim insert failed", claimError);
    return NextResponse.json({ ok: true, skipped: "claim-failed" });
  }

  const abortClaim = async () => {
    const { error } = await admin.from("playbook_sends").delete().eq("send_date", sendDate);
    if (error) console.error("[playbook] claim rollback failed", error);
  };

  // Sends across the loop below — declared above the outer try so the catch
  // can tell a clean pre-send failure (roll the claim back, safe to retry)
  // apart from a failure after mail already went out (keep the claim; a
  // retry would re-send to everyone who already got today's Playbook).
  let successCount = 0;

  try {
    if (!hasSigningKey()) {
      console.error("[playbook] PLAYBOOK_SIGNING_KEY not configured");
      await abortClaim();
      return NextResponse.json({ ok: false, skipped: "no-signing-key" });
    }

    // Recipients: confirmed auth users ∩ citizens ∩ not opted out.
    const { data: usersRes, error: usersError } = await admin.auth.admin.listUsers({ perPage: LISTUSERS_PAGE_SIZE });
    if (usersError) throw usersError;
    const users = usersRes?.users ?? [];
    if (users.length === LISTUSERS_PAGE_SIZE) {
      console.warn("[playbook] listUsers returned exactly", LISTUSERS_PAGE_SIZE, "rows — may be truncated, pagination not implemented");
    }
    const confirmedEmailById = new Map(
      users.filter((u) => u.email_confirmed_at && u.email).map((u) => [u.id, u.email as string])
    );

    const { data: citizens, error: citizensError } = await admin
      .from("citizens")
      .select("id, playbook_opt_out");
    if (citizensError) throw citizensError;
    if ((citizens ?? []).length === LISTUSERS_PAGE_SIZE) {
      console.warn("[playbook] citizens query returned exactly", LISTUSERS_PAGE_SIZE, "rows — may be truncated");
    }

    const recipients: Recipient[] = [];
    for (const c of citizens ?? []) {
      if (c.playbook_opt_out) continue;
      const email = confirmedEmailById.get(c.id);
      if (!email) continue;
      recipients.push({ id: c.id, email });
    }

    if (recipients.length === 0) {
      await abortClaim();
      return NextResponse.json({ ok: true, skipped: "no-recipients" });
    }

    // Content: latest episode + up to 3 published articles.
    let episode: PlaybookContent["episode"] = null;
    let articles: PlaybookContent["articles"];
    try {
      episode = await readClient.fetch(
        `*[_type == "episode"] | order(publishedAt desc)[0]{ ytId, title, thumbnailUrl }`
      );
      // An episode doc missing its ytId can't render a watch link or a
      // stable content-key component — treat it as no episode at all.
      if (episode && !episode.ytId) episode = null;
      const sanityArticles = await getPublishedArticles(3);
      articles = sanityArticles.map((a) => ({ headline: a.headline, dek: a.dek, slug: a.slug.current }));
    } catch (err) {
      console.error("[playbook] sanity unreachable", err);
      await abortClaim();
      return NextResponse.json({ ok: false, skipped: "sanity-unreachable" });
    }

    if (!episode && articles.length === 0) {
      await abortClaim();
      return NextResponse.json({ ok: true, skipped: "no-content" });
    }

    const content: PlaybookContent = { episode, articles };

    // Skip the send if today's content is identical to the last send's —
    // no point re-mailing the same episode/articles because nothing new
    // published since.
    const contentKey = [episode?.ytId ?? "", ...articles.map((a) => a.slug)].join("|");
    const { data: lastSend, error: lastSendError } = await admin
      .from("playbook_sends")
      .select("content_key")
      .lt("send_date", sendDate)
      .order("send_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastSendError) throw lastSendError;
    if (lastSend?.content_key && lastSend.content_key === contentKey) {
      await abortClaim();
      return NextResponse.json({ ok: true, skipped: "nothing-new" });
    }

    const weekday = new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: "America/New_York" });
    const { subject: rawSubject, intro } = await draftPlaybookIntro({
      weekday,
      episodeTitle: episode?.title ?? null,
      articleHeadlines: articles.map((a) => a.headline),
    });
    // Resend rejects (or worse, header-injects on) a subject carrying raw
    // CR/LF — the intro is model-drafted, so don't trust it not to.
    const subject = rawSubject.replace(/[\r\n]+/g, " ");

    for (const r of recipients) {
      try {
        const sig = signUid(r.id);
        const unsubscribeUrl = `${SITE_URL}/api/playbook/unsubscribe?uid=${r.id}&sig=${sig}`;
        const html = renderPlaybookHtml(content, { intro, unsubscribeUrl });
        const text = renderPlaybookText(content, { intro, unsubscribeUrl });

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: FROM,
            reply_to: "porch@thepatestate.com",
            to: [r.email],
            subject,
            html,
            text,
            headers: {
              "List-Unsubscribe": `<${unsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }),
        });

        if (!res.ok) {
          const bodyText = await res.text();
          console.error("[playbook] resend send failed", r.id, res.status, bodyText.slice(0, 200));
          continue;
        }
        successCount++;
      } catch (err) {
        console.error("[playbook] send failed", r.id, err);
      }
    }

    if (successCount === 0) {
      // Nothing went out — leave no record of an attempt so a retry (manual or
      // next cron tick, once the underlying issue is fixed) is not blocked.
      await abortClaim();
      return NextResponse.json({ ok: false, skipped: "all-sends-failed" });
    }

    const { error: patchError } = await admin
      .from("playbook_sends")
      .update({ recipients: successCount, content_key: contentKey })
      .eq("send_date", sendDate);
    if (patchError) console.error("[playbook] claim patch failed", patchError);

    return NextResponse.json({ ok: true, sent: successCount, attempted: recipients.length });
  } catch (err) {
    console.error("[playbook] send failed", err);
    if (successCount === 0) {
      await abortClaim();
    } else {
      console.error("[playbook] error after", successCount, "successful sends — keeping claim, not retrying");
    }
    return NextResponse.json({ ok: false, skipped: "error" });
  }
}
