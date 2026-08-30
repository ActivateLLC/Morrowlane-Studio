# Creative service (ComfyUI)

Isolated media-generation service, exactly as the spec directs: ComfyUI stays its own
process and Morrowlane talks to it over HTTP, so a GPU box can host it independently of
the product.

```bash
git clone https://github.com/Comfy-Org/ComfyUI.git
cd ComfyUI && pip install -r requirements.txt
python main.py --listen 0.0.0.0 --port 8188
```

Set `CREATIVE_SERVICE_URL=http://localhost:8188`. The worker's `render_media` job
submits the workflow in `workflows/branded-image.json` with the brand's colours, logo
and the content item's visual direction substituted in, then polls `/history/{id}` and
stores the output as a `MediaAsset` (renderer: "comfyui").

`workflows/` holds the workflow graphs as exported from ComfyUI ("Save (API format)").
Each is a template: node inputs whose values are `{{placeholders}}` are filled by the
worker per render.
