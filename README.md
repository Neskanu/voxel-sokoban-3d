# Crate Expectations (Voxel Sokoban 3D)

A 3D voxel puzzle diorama & **Telegram Mini App** built with plain HTML, CSS, and JavaScript using **Three.js**, **Tailwind CSS**, and **Tone.js** — with zero runtime build dependencies.

## Features
- **500 Built-in Levels**: Starter (20), Classic (80), and 4 Master Packs (400 puzzles) unlockable via stars, Voxel Coins, or optional Telegram Stars (`XTR`).
- **Telegram Mini App Native Integration**:
  - Mobile fullscreen (`requestFullscreen()`) with `safeAreaInset` / `contentSafeAreaInset` handling and expanded desktop layout (`expand()`).
  - Vertical swipe protection (`disableVerticalSwipes()`), native `BackButton`, `HapticFeedback`, and theme-matched header/background colors.
  - Chunked `Telegram.WebApp.CloudStorage` sync for cross-device progress persistence.
  - Optional Telegram Stars (`XTR`) IAP invoice & restore hooks (see [docs/TELEGRAM_SETUP.md](docs/TELEGRAM_SETUP.md)).
- **3-Star Par & Scoring System**: Efficiency-based scoring, star ratings, and Voxel Shop cosmetics (themes, bot skins, crate styles).
- **`.xsb` Pack Importer**: Paste standard ASCII Sokoban maps (`#`, `$`, `.`, `@`, `*`, `+`) to load custom levels into 3D.
- **Multi-Input Controls**: Touchscreen swipe/pinch/tap/D-pad, mouse orbit/pan/click-to-move, and keyboard support.
- **Procedural Audio & Soundtrack**: Lo-fi BGM + Web Audio sound effects synthesized in real time via Tone.js.

## Running & Building
- **Local Static Server**:
  ```bash
  python -m http.server 8080
  ```
  Visit `http://localhost:8080` (or `http://localhost:8080/?platform=telegram` to test the Telegram adapter).
- **Production Bundle**:
  ```bash
  npm run build
  ```
  Verifies JS syntax across `js/` and packages the static site into `dist/web/` and `dist/voxel-sokoban-3d-telegram.zip`.
- **Telegram Deployment & Stars Backend**: See [docs/TELEGRAM_SETUP.md](docs/TELEGRAM_SETUP.md).

## Controls
- **Keyboard**:
  - `W` / `A` / `S` / `D` or Arrow keys: Move / push crates
  - `Z` / `Ctrl+Z` / `Backspace`: Undo move
  - `R`: Reset level
  - `Q` / `E`: Rotate camera
  - `Esc`: Close open Settings or Level Select modal
- **Mouse**:
  - Left-drag: Orbit camera
  - Right-drag / Middle-drag / `Shift` + drag: Pan map
  - Scroll wheel: Zoom in / out
  - Click tile: Step toward aligned tile
- **Touch**:
  - Swipe: Pan map
  - Two-finger pinch: Zoom in / out
  - Tap tile or use on-screen D-Pad: Move

## Project Structure
```text
├── index.html          # Semantic HTML layout & modal containers
├── css/
│   └── styles.css      # Custom styles, arcade buttons, D-pad & modal transitions
└── js/
    ├── config.js       # Global constants and storage keys
    ├── levels.js       # Classic & Starter level packs + ASCII .xsb parser
    ├── storage.js      # Persistent progress, star ratings & settings
    ├── audio.js        # Tone.js procedural sound effects engine
    ├── voxels.js       # Shared Three.js materials, voxel builders & particles
    ├── renderer.js     # Scene, lighting, board builder, camera & animation loop
    ├── game.js         # Core Sokoban game state, movement, undo & win logic
    ├── ui.js           # HUD, Level Select, Main Menu, Settings & Victory modals
    ├── input.js        # Touch, mouse, D-pad, keyboard & UI event wiring
    └── main.js         # Application bootstrap on window load
```
