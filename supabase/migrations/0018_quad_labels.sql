-- 0018: "The Porch" → "The Quad" (labels only).
--
-- Slugs deliberately DO NOT change: /community/front-porch and
-- /community/<team>-porch stay live so no URL breaks and no redirect is
-- needed. app/notebook/[slug]/page.tsx still looks up the national board by
-- the literal slug 'front-porch'. Only `name` and `description` are rendered.
--
-- Every statement is idempotent — safe to re-run.

-- National board: "The Front Porch" becomes "The Main Quad" (plain
-- "The Quad" is the product name, so the board keeps a distinct label).
update public.boards
   set name = 'The Main Quad'
 where slug = 'front-porch'
   and name is distinct from 'The Main Quad';

-- Team boards: "Georgia Porch" → "Georgia Quad", etc.
update public.boards
   set name = replace(name, 'Porch', 'Quad')
 where name like '%Porch%';

-- Descriptions: "The Dawgs' corner of the porch." → "… of the Quad."
update public.boards
   set description = replace(replace(description, 'the porch', 'the Quad'), 'Porch', 'Quad')
 where description ilike '%porch%';

-- System author label written by app/api/community/game-threads/route.ts.
update public.threads
   set author_label = 'The Quad Desk'
 where author_label = 'The Porch Desk';
