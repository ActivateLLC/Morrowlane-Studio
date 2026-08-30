# Social provider status

Each adapter carries its network's real OAuth endpoints, scopes and documented publish
flow. Live-API paths cannot be exercised in unit tests; the mock registry
(`MORROWLANE_MOCK_SOCIAL=1`) covers the pipeline itself, and each adapter needs a
verification pass against a developer app before production use.

| Channel | Auth | Publish flow | Notes |
| --- | --- | --- | --- |
| Instagram | Meta OAuth | container(s) → `media_publish` | requires a professional account; media required |
| Facebook | Meta OAuth | Page `/feed` | native scheduling supported (`scheduled_publish_time`) |
| TikTok | OAuth + PKCE (`client_key`) | `post/publish/video/init` PULL_FROM_URL | video required |
| LinkedIn | OAuth | `ugcPosts` | member posts; org posts need `w_organization_social` |
| X | OAuth 2.0 + PKCE | `POST /2/tweets`, threads as reply chains | |
| Threads | Threads OAuth | container → `threads_publish` | |
| YouTube | Google OAuth | upload via video service | resumable upload lives in `services/video` |
| Pinterest | OAuth | `POST /v5/pins` | needs a board id in connection metadata |
| Google Business | Google OAuth | `localPosts` | needs a location in connection metadata |
| Bluesky | app password (AT Protocol) | `createRecord`, threads as reply chains | no OAuth redirect |

Postiz (AGPL) is a useful behavioural reference for these flows; its code is not
vendored here.
