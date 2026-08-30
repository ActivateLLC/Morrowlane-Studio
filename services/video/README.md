# Video service (Remotion)

Programmatic video rendering for short-form content, animated text and branded motion.
Kept as its own service because rendering is CPU-bound and versioned separately.

Note: Remotion is source-available under its own license; companies above its size
threshold need a paid license before commercial deployment. Confirm at remotion.dev
before shipping.

```bash
cd services/video
npm install
npm run render -- --props='{"script":…}'   # renders a composition to out/
npm run serve                              # render server on :8030
```

The worker's `render_media` job posts a content item's segments (each with body and
visualDirection) to `POST /render`; the service maps them onto the `ShortVideo`
composition beats and returns the file URL, stored as a `MediaAsset`
(renderer: "remotion").
