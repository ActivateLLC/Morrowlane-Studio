# Automation service (n8n)

Internal infrastructure only — per the spec (and n8n's Sustainable Use License), n8n is
not resold as the customer-facing workflow builder. It handles the integrations
Morrowlane needs behind the scenes: CRM sync, email notifications, lead routing,
webhook fan-out.

```bash
docker compose up -d
```

Workflows call back into Morrowlane through the API service:
`POST /v1/events` with the deployment's `MORROWLANE_INGEST_KEY` records leads,
customers and revenue into the attribution graph — which is how a CRM "deal won"
becomes revenue attributed to the post that started it.
