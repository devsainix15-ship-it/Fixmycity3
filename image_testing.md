# Image / AI Classification Testing Playbook (FixMyCity)

The AI auto-categorization endpoint is `POST /api/issues/classify` (auth required) with body `{"image_url": "/api/uploads/<file>", "description": "<text>"}`. It uses a vision LLM on the uploaded photo, with a keyword fallback on the description.

## Image handling rules for tests
- Upload real images via `POST /api/upload` (multipart field name `file`), then pass the returned `url` to classify.
- Accepted formats: JPEG, PNG, WEBP only. No SVG/BMP/HEIC/GIF.
- Do not use blank/solid-color images — must contain real visual features.
- Seed test images are available at `/app/backend/uploads/seed/*.jpg` (e.g. `road1.jpg`, `garbage1.jpg`, `streetlight2.jpg`, `electricity1.jpg`, `water1.jpg`) — their URLs are `/api/uploads/seed/<name>`.

## Example
```
TOKEN=<citizen token>
curl -X POST $API/api/issues/classify -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"image_url":"/api/uploads/seed/road1.jpg","description":"huge pothole"}'
```
Expected: `{"category":"roads","confidence":...,"source":"ai"}` (or keyword/fallback if vision unavailable — both are acceptable outcomes, response must always contain a valid category from: electricity, roads, water, sanitation, streetlights, other).
