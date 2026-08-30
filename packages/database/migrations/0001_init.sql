-- Morrowlane Studio: core schema.
-- Every row is reachable from an organization, and every policy is written against
-- membership of that organization. There is no path to another tenant's data.

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ---------------------------------------------------------------------------
-- Accounts
-- ---------------------------------------------------------------------------

create table if not exists organizations (
  id text primary key,
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create type member_role as enum ('owner', 'admin', 'editor', 'viewer');

create table if not exists memberships (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  role member_role not null default 'editor',
  invited_at timestamptz not null default now(),
  accepted_at timestamptz,
  unique (organization_id, user_id)
);

create index if not exists memberships_user_idx on memberships (user_id);

-- Membership lookups run inside every policy, so this is security definer to avoid
-- recursive policy evaluation on memberships itself.
create or replace function is_org_member(org_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where memberships.organization_id = org_id
      and memberships.user_id = auth.uid()
      and memberships.accepted_at is not null
  );
$$;

create or replace function can_edit_org(org_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where memberships.organization_id = org_id
      and memberships.user_id = auth.uid()
      and memberships.accepted_at is not null
      and memberships.role in ('owner', 'admin', 'editor')
  );
$$;

-- ---------------------------------------------------------------------------
-- Brands and website intelligence
-- ---------------------------------------------------------------------------

create type brand_status as enum ('draft', 'crawling', 'analyzing', 'ready', 'failed');

create table if not exists brands (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  name text not null,
  website_url text not null,
  status brand_status not null default 'draft',
  status_detail text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brands_org_idx on brands (organization_id);

create table if not exists brand_pages (
  id text primary key,
  brand_id text not null references brands (id) on delete cascade,
  url text not null,
  canonical_url text,
  page_type text not null,
  page_type_confidence real not null default 0,
  title text,
  meta_description text,
  headings jsonb not null default '[]',
  body_text text not null default '',
  word_count integer not null default 0,
  language text,
  images jsonb not null default '[]',
  internal_links jsonb not null default '[]',
  external_links jsonb not null default '[]',
  social_links jsonb not null default '[]',
  faqs jsonb not null default '[]',
  testimonials jsonb not null default '[]',
  ctas jsonb not null default '[]',
  prices jsonb not null default '[]',
  structured_data jsonb not null default '[]',
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  content_hash text not null,
  -- Populated by the embedding job; drives semantic retrieval for generation.
  embedding vector(1536),
  unique (brand_id, url)
);

create index if not exists brand_pages_brand_idx on brand_pages (brand_id);
create index if not exists brand_pages_type_idx on brand_pages (brand_id, page_type);

-- Brains are versioned rather than updated so a regression can be traced and rolled back.
create table if not exists brand_brains (
  id text primary key,
  brand_id text not null references brands (id) on delete cascade,
  version integer not null,
  payload jsonb not null,
  completeness real not null default 0,
  source_page_count integer not null default 0,
  locked_fields jsonb not null default '[]',
  generated_at timestamptz not null default now(),
  unique (brand_id, version)
);

create index if not exists brand_brains_current_idx on brand_brains (brand_id, version desc);

-- ---------------------------------------------------------------------------
-- Campaigns and content
-- ---------------------------------------------------------------------------

create type campaign_status as enum ('draft', 'planning', 'ready', 'active', 'complete', 'archived');

create table if not exists campaigns (
  id text primary key,
  brand_id text not null references brands (id) on delete cascade,
  name text not null,
  goal text not null,
  product_id text,
  channels jsonb not null default '[]',
  duration_days integer not null,
  start_date timestamptz not null,
  status campaign_status not null default 'draft',
  narrative text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campaigns_brand_idx on campaigns (brand_id);

create table if not exists campaign_phases (
  id text primary key,
  campaign_id text not null references campaigns (id) on delete cascade,
  kind text not null,
  title text not null,
  narrative text not null default '',
  start_day integer not null,
  end_day integer not null,
  post_count integer not null default 0,
  position integer not null default 0
);

create index if not exists campaign_phases_campaign_idx on campaign_phases (campaign_id, position);

create type content_status as enum ('draft', 'needs_review', 'approved', 'scheduled', 'published', 'failed', 'archived');

create table if not exists content_items (
  id text primary key,
  brand_id text not null references brands (id) on delete cascade,
  campaign_id text references campaigns (id) on delete set null,
  campaign_phase_id text references campaign_phases (id) on delete set null,
  format text not null,
  channel text not null,
  status content_status not null default 'draft',
  title text not null,
  hook text not null default '',
  body text not null default '',
  segments jsonb not null default '[]',
  hashtags jsonb not null default '[]',
  cta text,
  link_url text,
  media_asset_ids jsonb not null default '[]',
  topics jsonb not null default '[]',
  -- The head of the attribution graph: where this came from and why.
  lineage jsonb not null default '{}',
  violations jsonb not null default '[]',
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_brand_idx on content_items (brand_id, created_at desc);
create index if not exists content_campaign_idx on content_items (campaign_id);
create index if not exists content_status_idx on content_items (brand_id, status);
create index if not exists content_source_url_idx on content_items ((lineage ->> 'sourceUrl'));

create table if not exists media_assets (
  id text primary key,
  brand_id text not null references brands (id) on delete cascade,
  kind text not null,
  url text not null,
  thumbnail_url text,
  prompt text,
  width integer,
  height integer,
  duration_seconds real,
  renderer text not null,
  created_at timestamptz not null default now()
);

create index if not exists media_brand_idx on media_assets (brand_id);

-- ---------------------------------------------------------------------------
-- Connections, scheduling and publishing
-- ---------------------------------------------------------------------------

create type connection_status as enum ('active', 'expired', 'revoked', 'error');

create table if not exists social_connections (
  id text primary key,
  brand_id text not null references brands (id) on delete cascade,
  channel text not null,
  display_name text not null,
  external_account_id text not null,
  status connection_status not null default 'active',
  scopes jsonb not null default '[]',
  -- Tokens are encrypted by the application before they reach this column and are
  -- never selectable by an end-user role; only the service role reads them.
  access_token_encrypted text,
  refresh_token_encrypted text,
  metadata jsonb not null default '{}',
  expires_at timestamptz,
  last_validated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (brand_id, channel, external_account_id)
);

create index if not exists connections_brand_idx on social_connections (brand_id);

create type schedule_status as enum ('scheduled', 'publishing', 'published', 'failed', 'cancelled');

create table if not exists scheduled_posts (
  id text primary key,
  brand_id text not null references brands (id) on delete cascade,
  content_id text not null references content_items (id) on delete cascade,
  connection_id text references social_connections (id) on delete set null,
  channel text not null,
  scheduled_for timestamptz not null,
  status schedule_status not null default 'scheduled',
  attempts integer not null default 0,
  last_error text,
  external_post_id text,
  external_url text,
  published_at timestamptz
);

create index if not exists scheduled_brand_time_idx on scheduled_posts (brand_id, scheduled_for);
-- The worker's hot path: what is due right now.
create index if not exists scheduled_due_idx on scheduled_posts (status, scheduled_for)
  where status = 'scheduled';

-- ---------------------------------------------------------------------------
-- Intelligence
-- ---------------------------------------------------------------------------

create table if not exists competitors (
  id text primary key,
  brand_id text not null references brands (id) on delete cascade,
  name text not null,
  website_url text not null,
  last_checked_at timestamptz,
  snapshot jsonb,
  signals jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists competitors_brand_idx on competitors (brand_id);

create table if not exists trends (
  id text primary key,
  brand_id text not null references brands (id) on delete cascade,
  topic text not null,
  source text not null,
  summary text not null default '',
  relevance real not null default 0,
  momentum real not null default 0,
  expires_at timestamptz,
  observed_at timestamptz not null default now()
);

create index if not exists trends_brand_idx on trends (brand_id, relevance desc);

create table if not exists insights (
  id text primary key,
  brand_id text not null references brands (id) on delete cascade,
  dimension text not null,
  subject text not null,
  comparison text,
  lift real not null default 1,
  metric text not null,
  sample_size integer not null default 0,
  confidence real not null default 0,
  statement text not null,
  applied boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists insights_brand_idx on insights (brand_id, created_at desc);

create table if not exists attribution_events (
  id text primary key,
  brand_id text not null references brands (id) on delete cascade,
  content_id text references content_items (id) on delete set null,
  scheduled_post_id text references scheduled_posts (id) on delete set null,
  channel text,
  stage text not null,
  value double precision not null default 1,
  currency text,
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'
);

create index if not exists events_brand_time_idx on attribution_events (brand_id, occurred_at desc);
create index if not exists events_content_idx on attribution_events (content_id);

create table if not exists post_metrics (
  scheduled_post_id text primary key references scheduled_posts (id) on delete cascade,
  brand_id text not null references brands (id) on delete cascade,
  impressions integer not null default 0,
  engagements integer not null default 0,
  clicks integer not null default 0,
  shares integer not null default 0,
  comments integer not null default 0,
  collected_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Jobs
-- ---------------------------------------------------------------------------

create type job_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');

create table if not exists jobs (
  id text primary key,
  organization_id text not null references organizations (id) on delete cascade,
  brand_id text references brands (id) on delete cascade,
  kind text not null,
  status job_status not null default 'queued',
  payload jsonb not null default '{}',
  result jsonb,
  error text,
  progress real not null default 0,
  progress_label text,
  attempts integer not null default 0,
  run_after timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

-- The claim query orders by run_after over queued rows only.
create index if not exists jobs_claim_idx on jobs (status, run_after) where status = 'queued';
create index if not exists jobs_brand_idx on jobs (brand_id, created_at desc);

/**
 * Claims one job atomically. Concurrent workers cannot take the same row: the
 * skip-locked select leaves a contended row to the other worker rather than blocking.
 */
create or replace function claim_job(worker_id text, kinds text[] default null)
returns jobs
language plpgsql
as $$
declare
  claimed jobs;
begin
  select * into claimed
  from jobs
  where status = 'queued'
    and run_after <= now()
    and (kinds is null or kind = any (kinds))
  order by run_after
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update jobs
  set status = 'running',
      attempts = attempts + 1,
      locked_at = now(),
      locked_by = worker_id,
      started_at = coalesce(started_at, now())
  where id = claimed.id
  returning * into claimed;

  return claimed;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table organizations enable row level security;
alter table memberships enable row level security;
alter table brands enable row level security;
alter table brand_pages enable row level security;
alter table brand_brains enable row level security;
alter table campaigns enable row level security;
alter table campaign_phases enable row level security;
alter table content_items enable row level security;
alter table media_assets enable row level security;
alter table social_connections enable row level security;
alter table scheduled_posts enable row level security;
alter table competitors enable row level security;
alter table trends enable row level security;
alter table insights enable row level security;
alter table attribution_events enable row level security;
alter table post_metrics enable row level security;
alter table jobs enable row level security;

create policy organizations_read on organizations
  for select using (is_org_member(id));
create policy organizations_write on organizations
  for update using (is_org_member(id));

create policy memberships_read on memberships
  for select using (is_org_member(organization_id));
create policy memberships_write on memberships
  for all using (
    exists (
      select 1 from memberships m
      where m.organization_id = memberships.organization_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );

create policy brands_read on brands for select using (is_org_member(organization_id));
create policy brands_write on brands for all using (can_edit_org(organization_id));

-- Brand-scoped tables all delegate to the brand's organization.
create or replace function can_read_brand(target_brand_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from brands
    where brands.id = target_brand_id and is_org_member(brands.organization_id)
  );
$$;

create or replace function can_edit_brand(target_brand_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from brands
    where brands.id = target_brand_id and can_edit_org(brands.organization_id)
  );
$$;

create policy brand_pages_read on brand_pages for select using (can_read_brand(brand_id));
create policy brand_pages_write on brand_pages for all using (can_edit_brand(brand_id));

create policy brand_brains_read on brand_brains for select using (can_read_brand(brand_id));
create policy brand_brains_write on brand_brains for all using (can_edit_brand(brand_id));

create policy campaigns_read on campaigns for select using (can_read_brand(brand_id));
create policy campaigns_write on campaigns for all using (can_edit_brand(brand_id));

create policy campaign_phases_read on campaign_phases for select using (
  exists (select 1 from campaigns c where c.id = campaign_id and can_read_brand(c.brand_id))
);
create policy campaign_phases_write on campaign_phases for all using (
  exists (select 1 from campaigns c where c.id = campaign_id and can_edit_brand(c.brand_id))
);

create policy content_read on content_items for select using (can_read_brand(brand_id));
create policy content_write on content_items for all using (can_edit_brand(brand_id));

create policy media_read on media_assets for select using (can_read_brand(brand_id));
create policy media_write on media_assets for all using (can_edit_brand(brand_id));

-- Connections carry tokens. Members may see that a connection exists; the encrypted
-- token columns are only ever read by the service role, which bypasses RLS.
create policy connections_read on social_connections for select using (can_read_brand(brand_id));
create policy connections_write on social_connections for all using (can_edit_brand(brand_id));

create policy scheduled_read on scheduled_posts for select using (can_read_brand(brand_id));
create policy scheduled_write on scheduled_posts for all using (can_edit_brand(brand_id));

create policy competitors_read on competitors for select using (can_read_brand(brand_id));
create policy competitors_write on competitors for all using (can_edit_brand(brand_id));

create policy trends_read on trends for select using (can_read_brand(brand_id));
create policy trends_write on trends for all using (can_edit_brand(brand_id));

create policy insights_read on insights for select using (can_read_brand(brand_id));
create policy insights_write on insights for all using (can_edit_brand(brand_id));

create policy events_read on attribution_events for select using (can_read_brand(brand_id));
create policy events_write on attribution_events for all using (can_edit_brand(brand_id));

create policy metrics_read on post_metrics for select using (can_read_brand(brand_id));
create policy metrics_write on post_metrics for all using (can_edit_brand(brand_id));

create policy jobs_read on jobs for select using (is_org_member(organization_id));
create policy jobs_write on jobs for all using (can_edit_org(organization_id));
