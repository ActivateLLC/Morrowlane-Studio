-- Hardening from Supabase advisor findings (applied to production 2026-08-30).

-- Extensions do not belong in the API-exposed public schema.
create schema if not exists extensions;
alter extension vector set schema extensions;

-- claim_job ran with a role-mutable search_path.
alter function public.claim_job(text, text[]) set search_path = public;

-- The RLS helper functions must stay executable by authenticated users — policies
-- evaluate them as the querying role — but anonymous callers have no business with
-- them, and job claiming belongs to the service role alone.
-- (The advisor still notes that `authenticated` can execute the helpers; that is
-- intentional and they only return membership booleans about the caller.)
revoke execute on function public.is_org_member(text) from anon, public;
revoke execute on function public.can_edit_org(text) from anon, public;
revoke execute on function public.can_read_brand(text) from anon, public;
revoke execute on function public.can_edit_brand(text) from anon, public;

revoke execute on function public.claim_job(text, text[]) from anon, authenticated, public;
