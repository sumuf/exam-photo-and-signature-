# UPSC Camera Photo & Signature Prep App

Simple mobile-first web app with two modes:
- `Prepare Photo`: UPSC photo flow, output `photo.jpg` (`JPG/JPEG`, `20KB to 200KB`)
- `Prepare Signature`: UPSC triple-signature flow, output `signature.jpg` (`JPG/JPEG`, `20KB to 100KB`, `350px to 500px`)

## Run

Serve the folder with any static server, for example:

```powershell
cd F:\upsccamera
python -m http.server 8080
```

Then open:

`http://localhost:8080`

## Phone Access Note

When opened as `http://<LAN-IP>:8080`, many mobile browsers block live camera APIs (`getUserMedia`) because the page is not HTTPS.

Use either:
- `Take Photo (Phone)` / `Take Signature (Phone)` fallbacks in the app, or
- HTTPS hosting for live camera preview.

## Config

All main UPSC settings are in:

`src/config.js`

You can edit photo/signature output dimensions, size limits, validation thresholds, and guide settings there.
