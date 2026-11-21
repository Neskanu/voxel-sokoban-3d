# Voxel Sokoban 3D

A 3D voxel puzzle diorama built with plain HTML, CSS, and JavaScript using **Three.js**, **Tailwind CSS**, and **Tone.js** — with zero build tools required.

## Features
- **24 Built-in Levels**: 18 Classic warehouse puzzles and 6 Starter levels with star-based progression.
- **3-Star Par & Scoring System**: Efficiency-based scoring and star ratings saved locally in `localStorage`.
- **`.xsb` Pack Importer**: Paste standard ASCII Sokoban maps (`#`, `$`, `.`, `@`, `*`, `+`) to load custom levels into 3D.
- **Multi-Input Controls**: Touchscreen swipe/pinch/D-pad, mouse orbit/pan/click-to-move, and keyboard support.
- **Procedural Audio**: Web Audio sound effects synthesized in real time via Tone.js.

## Running Locally
- **Direct File**: Open `index.html` directly in any modern browser.
- **Local Static Server**:
  ```bash
  python -m http.server 8080
  ```
  Then visit `http://localhost:8080`.

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
