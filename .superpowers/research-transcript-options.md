# YouTube Transcript Sourcing — Cost Research (Aug 2026)

Context: Next.js app on Vercel needs transcripts for one YouTube channel's new
uploads, ~5-7 videos/week (~25-30/month), 30-90 min each, English, auto-captions
already exist. Fetching caption tracks directly from YouTube is blocked from
Vercel's datacenter IPs. Baseline plan: $6/mo Webshare residential proxy in
front of existing caption-fetch code. Question: is there something cheaper,
e.g. AssemblyAI?

## 1. Third-party YouTube transcript APIs (they eat the proxy problem for you)

| Service | Free tier | Cheapest paid tier | Notes |
|---|---|---|---|
| **Supadata** | 100 credits/mo (1 credit = 1 transcript, resets monthly) | Pro: $17/mo for 3,000 credits (~$5.67/1k) | Multi-platform scraper (YouTube/TikTok/IG/X). Has AI fallback for videos with no captions (billed higher per-minute), but this channel already has auto-captions so it stays on the cheap caption-fetch path. 100/mo free tier comfortably covers 25-30/mo with room for retries. |
| **youtube-transcript.io** | 25 tokens/mo | Plus: $9.99/mo for 1,000 transcripts | Free tier is exactly at the edge of a 25-30/mo need — no buffer for retries/failed fetches. Would likely need the $9.99 Plus plan for reliability headroom. |
| **SearchAPI.io** (youtube_transcripts engine) | 100 free searches (one-time signup credit, not recurring monthly) | Developer: $40/mo for 10,000 searches ($4/1k) | No engine-specific pricing tier; billed from the same general search-credit pool. Wildly overkill and expensive for 25/mo — cheapest recurring plan is $40/mo regardless of how few you use. |
| **Apify** (YouTube transcript actors — several competing ones) | $5/mo platform credit, recurring, no card required | Pay-per-result actors range $0.50–$3 per 1,000 results ($0.01–$0.08 for 25 transcripts); a few outlier actors go as low as $0.01/video | At this volume, the $5/mo free credit covers the actor cost with room to spare — effectively $0/mo. Caveat: quality/reliability varies a lot by actor (community-maintained), so pick one with recent reviews and test it before relying on it. |
| **RapidAPI marketplace options** | Varies by vendor; some offer ~1,000 free requests/mo | Varies, generally cheap ($ a few /mo) | Many competing vendors of wildly varying quality; "reliability varies significantly between providers" is the consistent theme in reviews. Fine as a backup, not as sole dependency. |

## 2. Speech-to-text route (AssemblyAI, Deepgram, OpenAI Whisper, Groq)

**Critical caveat, verified:** none of these accept a YouTube URL directly.
AssemblyAI's `audio_url` parameter requires a "publicly-accessible" *direct
media file* URL (their own docs example: `https://assembly.ai/wildfires.mp3`)
— a YouTube watch-page URL doesn't qualify. Deepgram, OpenAI, and Groq work
the same way: they transcribe an audio file/URL you already have, they don't
scrape YouTube. So to use any STT API you'd still need to download the audio
from YouTube first (e.g. via yt-dlp), which hits **the exact same
datacenter-IP block** that's blocking caption fetches today. STT does not
remove the proxy requirement — it adds transcription cost on top of it.

Per-hour pricing (current, 2026):

| Provider | Price/hr (batch/pre-recorded) | 25 hrs/mo | 30 hrs/mo |
|---|---|---|---|
| Groq Whisper Large v3 Turbo | $0.04/hr | $1.00 | $1.20 |
| Groq Whisper Large v3 | $0.111/hr | $2.78 | $3.33 |
| AssemblyAI Universal-2 | $0.15/hr | $3.75 | $4.50 |
| AssemblyAI Universal-3.5 Pro | $0.21/hr | $5.25 | $6.30 |
| OpenAI gpt-4o-mini-transcribe | ~$0.18/hr | $4.50 | $5.40 |
| Deepgram Nova-3 (pay-as-you-go) | $0.26/hr | $6.50 | $7.80 |
| OpenAI Whisper API | $0.36/hr | $9.00 | $10.80 |

Even the cheapest (Groq, ~$1-1.20/mo) is **additive** to whatever you pay to
get the audio out of YouTube in the first place — realistically the same
$3.50-$6/mo residential proxy, since yt-dlp audio downloads face the same
datacenter-IP wall as caption XML fetches. Total STT-route cost: roughly
$4.50-$14/mo depending on provider, plus meaningfully more engineering
(download full audio, upload/stream to STT API, handle 30-90 min files,
poll for completion) for output quality that's a lateral move at best —
auto-captions already exist and are what YouTube's own ASR produces.

## 3. Webshare residential proxy baseline (sanity check)

Current official pricing (webshare.io/pricing, verified):

| Plan | Price | Effective $/GB |
|---|---|---|
| 1 GB | $3.50/mo (50% off list) | $3.50/GB |
| 10 GB | $27.50/mo | $2.75/GB |
| 25 GB | $65/mo | $2.60/GB |
| 100 GB | $225/mo | $2.25/GB |

No smaller pay-as-you-go/metered tier below the 1 GB plan exists — 1 GB is
the floor. Bandwidth needed here (caption XML files for ~25-30 videos/month)
is a few MB, so the $3.50/mo 1 GB plan (or the $6/mo tier the owner
originally quoted, likely a slightly older/different promo price) is already
massive overkill on capacity but is the cheapest available entry point.
Webshare also has a permanently-free plan (10 proxies, 1 GB bandwidth) that
may itself be sufficient for this tiny volume — worth testing before paying
anything.

## Cost ranking at 25 transcripts/month

| Rank | Option | Monthly cost | Caveat |
|---|---|---|---|
| 1 | Supadata free tier | $0 | 100 free credits/mo comfortably covers 25-30; third-party dependency |
| 1 (tie) | Apify pay-per-result actor | $0 (within $5/mo free credit) | Actor quality/reliability varies; test before relying on it |
| 3 | Webshare free plan | $0 | 1 GB/mo free bandwidth may be enough; untested at scale, own code stays |
| 4 | Webshare paid (existing plan) | $3.50-$6/mo | Known-working architecture, full control, no rate-limit risk from a vendor |
| 5 | youtube-transcript.io Plus | $9.99/mo | Needed because free tier (25 tokens) has zero retry buffer |
| 6 | Groq Whisper (STT) + proxy for audio download | ~$4.50-$7.20/mo combined | Still needs a proxy; more moving parts for no quality gain |
| 7 | AssemblyAI/Deepgram/OpenAI (STT) + proxy for audio download | ~$7-$16/mo combined | Same proxy dependency, higher STT cost, most engineering effort |
| 8 | SearchAPI.io | $40/mo minimum | No tier below $40/mo; free credit is one-time, not recurring |

## Recommendation

For 25-30 transcripts/month of a channel with existing auto-captions, the
Webshare-proxy-plus-existing-code plan isn't wrong, but it isn't the
cheapest either: **Supadata's free tier ($0/mo, 100 transcripts/month,
recurring)** covers this workload with 3-4x headroom for retries and
channel growth, and removes the proxy/maintenance burden entirely — it's
the strongest first choice, with **Apify's pay-per-result actors (also
effectively $0/mo under the $5/mo recurring free credit)** as a solid
runner-up or fallback if a Supadata rate limit or reliability hiccup ever
bites. Keep the $3.50-$6/mo Webshare proxy plan as a cheap backstop if
either free-tier vendor becomes unreliable — it's low-risk insurance, not
wasted money. The AssemblyAI/speech-to-text route is not the answer: none of
these APIs ingest a YouTube URL directly, so audio still has to be
downloaded from YouTube first, which hits the identical datacenter-IP block
the proxy was bought to solve — meaning STT would require keeping the proxy
*and* paying $1-$10+/mo in transcription costs on top, for output that's no
better than the auto-captions already available for free.
