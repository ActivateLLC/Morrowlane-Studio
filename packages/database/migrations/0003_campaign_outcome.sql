-- The guided flow (step 5) has the user pick a business outcome before a campaign is
-- planned. We persist that choice so the plan review, analytics and the "what to do
-- next" report can key off it. Nullable: free-form campaigns (the power-user path) have
-- no outcome.
alter table campaigns add column if not exists outcome text;
