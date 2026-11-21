# Techfest 2026: Enter the Aether

A 3D interactive website for **Techfest 2026, IIT Bombay**, built around this year's theme, *An Aetherial Renaissance*.

As you scroll, one object made of 3,200 glowing particles flies through space and reshapes itself five times. Each shape is one chapter of the fest.

| Chapter | 3D form | Story |
|---|---|---|
| Origin | Armillary orb (sphere + three orbit rings) | An Aetherial Renaissance |
| I · Arena | Torus | Robotics, hackathons, competitions |
| II · Ideas | Double helix | Lectures and workshops |
| III · Expo | Spiral galaxy | Tech Expo |
| IV · Thirty | The number **30** | 30th edition, 16–18 Dec 2026 |

## Interactions

- **3D scroll animation**: particles scatter mid-transition and reassemble into the next form. The camera framing and spin speed change for each chapter.
- **Drag the object**: rotate it in 3D, and it keeps turning with inertia when you let go.
- **Click to pulse**: sends a shockwave through the particles, which spring back into place.
- **Mouse parallax**: the scene tilts slightly toward your cursor.
- **Warp starfield**: the stars stretch into streaks when you scroll fast.
- **3D text transitions**: chapter titles flip in and out on the X axis.
- **3D event carousel**: a ring of eight event cards. Drag or swipe it, use the arrow buttons or ←/→ keys, and hover a card to tilt it toward your cursor.
- **Responsive**: fewer particles and different framing on mobile, a compact chapter nav, and a smaller ring.
- **Accessible**: keyboard support for the carousel, and support for `prefers-reduced-motion`.

## Tech

No libraries and no build step. The 3D engine in `main.js` is written from scratch:
perspective projection, Y/X rotation matrices, depth-sorted alpha and size, additive blending on a 2D canvas, and CSS `preserve-3d` for the carousel.

```
index.html   structure and copy
style.css    layout, 3D panel transitions, carousel
main.js      particle engine, morph targets, interactions, carousel
```

## Run

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

---
Fan-made concept for the Techfest 2026 web challenge. Official details: [techfest.org](https://techfest.org)
