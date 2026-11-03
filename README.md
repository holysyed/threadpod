# threadPod

A tactile web app for browsing coding threads inside a real Blender-built iPod model. The app uses a monochrome, classic iPod-style LCD and physical click-wheel hit testing, with a modern thread library alongside it.

## Run locally (Mac, Windows, or Linux)

Requires Node.js 20+ and npm. Install the Codex CLI and sign in normally to connect local Codex history.

```sh
npm install
npm run build
npm start
```

Open **http://127.0.0.1:4173**. The local app automatically reads saved, unarchived Codex threads through `codex app-server` and refreshes every 15 seconds. `CODEX_BIN` can specify the executable when it is not on PATH. `PORT` changes the default port.

**Runtime status limitation:** a new app-server connection does not necessarily observe a turn running in another Codex client. Such threads are honestly labeled **Saved**. This app does not start, stop, resume, or modify agents. Play/pause controls the browsing slideshow only.

## Web and Mac app

The hosted build runs without a server connection. Start with the clearly labeled demo collection or import your own thread JSON. Imported data and favorites are saved only in the current browser's local storage. No thread content is uploaded by the app.

On macOS, open the deployed site (or the running local app) in Safari and choose **File → Add to Dock**. In Chrome, use **Install page as app**. This is a web app; it is not a signed native `.app` or `.dmg`. Connecting local Codex requires keeping the local Node server running.

The hosted site intentionally never probes your computer's loopback ports. Use the local version for automatic Codex history refresh. Imported JSON is a snapshot, not an ongoing provider connection.

## Controls

- Drag around the wheel or scroll over the device to browse.
- Center button / Enter selects, then opens the conversation.
- MENU / Escape goes back; MENU again opens the classic library menu.
- Previous/next buttons and arrow keys move through threads.
- Play/pause / Space cycles the collection every 3.5 seconds.
- Drag the body to rotate the actual 3D model. Reset view returns it to the front.
- The HTML controls below the device provide a keyboard and accessible alternative.
- Use filters, search, favorites, wheel sounds, or ivory/graphite finishes.

## Import format

Import an array or an object with a `threads` array. Up to 1,000 threads and 5 MB per file. `title` is required. IDs must be unique. Missing status becomes `saved`. Accepted statuses are `active`, `waiting`, `completed`, `idle`, `saved`, and `error`. `updatedAt` accepts ISO dates or Unix timestamps. Optional `url` must use HTTPS/HTTP; otherwise Explore opens the built-in reader.

```json
{
  "threads": [{
    "id": "agent-session-1",
    "title": "Ship the new dashboard",
    "agent": "Claude Code",
    "project": "Dashboard",
    "status": "active",
    "updatedAt": "2026-11-03T02:00:00Z",
    "summary": "Building a clear view of the team's work.",
    "latest": "Checking the responsive layout.",
    "messages": [{"role":"agent","text":"The first implementation is ready."}]
  }]
}
```

## Blender source

- `model/threadpod.blend`: editable original Blender scene with camera and studio lights.
- `model/build_ipod.py`: reproducible Blender construction script.
- `public/models/threadpod.glb`: exported glTF binary used by the web app.

Rebuild the model with Blender 4.3+:

```sh
blender --background --python model/build_ipod.py
npm run build
```

The live LCD uses the `LCD_Display` mesh and a Three.js CanvasTexture. Wheel interaction raycasts against the model and accumulates angular movement across the ±π seam. The body has separate polycarbonate, steel, wheel, button, and engraved-label materials. There are no external model dependencies.

## Implementation and checks

Vanilla JavaScript + Three.js, bundled with esbuild. The local server uses Node built-ins. Source is in `src/`, static assets in `public/`, and production output in `dist/`.

```sh
npm test
npm run build
# With npm start running and Codex available:
node scripts/verify-local.mjs
```

The loopback server only accepts local Host headers, rejects cross-origin API access and write methods, and exposes an explicit read-only Codex method allowlist. Transcripts, credentials, and imported data are not part of the published build. The shell renders an accessible 2D library if WebGL fails. Appearance respects reduced-motion preferences; browsing animations require interaction.

References: [Codex App Server](https://learn.chatgpt.com/docs/app-server), [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html).

An independent interface experiment inspired by the classic iPod. Not affiliated with Apple.

