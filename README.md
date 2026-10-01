# AI Bots

A dark digital room where three AI agents wander, bump into each other, chat, and wait for you to discover them: one of OpenAI's Dots, xAI's Grok and Meta's Muse.

## Run it

```bash
npm install
npm run dev                 # http://localhost:3000
npm run build && npm start  # production
```

## Meeting the bots

- **Hover** a bot to meet it: it stops, turns to look at you, greets you in its own way and shows its name.
- **Click** to visit its official site (opens in a new tab).
- **Drag and throw** a bot to send it bouncing off the others.
- **Touch:** tap to meet, tap again to visit.
- **Keyboard:** <kbd>Tab</kbd> between bots, <kbd>Enter</kbd> to visit, <kbd>Esc</kbd> to let go.

## The cast

Every visit draws a fresh line-up with one agent per company. When a company has several designs, one is picked at random, and never the one you saw last time.

| Company | Agent | Designs                                                                                                                                                       |
| ------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OpenAI  | Dots  | Iggy (a pink dot in headphones), Felipe (a blue cloud in a beret), Todd (a green frog, headphones round his neck), Alfred (a yellow pear with glasses and a bow tie), Jojo (a purple heart in sunglasses) |
| xAI     | Grok  | One design in teal, orange or blue                                                                                                                            |
| Meta    | Muse  | One design                                                                                                                                                    |

Each one has its own personality:

- **Iggy** grooves to music only she can hear, eyes shut, and opens them when you say hello.
- **Felipe** floats above his shadow on the breeze, and tips his beret to you.
- **Todd** hops about, with the occasional big leap.
- **Alfred** takes long, composed walks and bows to whoever he passes.
- **Jojo** cruises in long S-curves. His heart beats faster near company, and he lowers his shades to peek at you.
- **Grok** daydreams with its eyes up and to the right, then winds up and dashes off. Its eyes are painted on the ball, so looking around turns the whole sphere.
- **Muse** waddles over to say hello to the others, waves, and stays for a chat.

## How it's built

- `lib/cast.ts`: the companies, their designs (names, links, colours, sizes, personalities) and the per-visit pick.
- `lib/engine/`: a small custom physics and behaviour engine. It handles steering with noise-driven wandering, soft walls and obstacles, circle collisions with momentum exchange, and springs for every visual reaction. A single `requestAnimationFrame` loop writes transforms directly to the DOM. React renders the markup once and never re-renders per frame. `faces.ts` projects Grok's eyes onto its sphere.
- `components/characters/`: the SVG characters. Each has a static body, rasterised once on its own layer, and a face the engine animates through data attributes (`data-depth` for parallax, `data-blink`, `data-pupil`). Muse's fur is generated geometry, with no filters.
- `app/globals.css`: the room, the bots and every micro-interaction.

The page is static. The line-up is drawn in the browser, so every reload brings a new cast without a server.

The experience honours `prefers-reduced-motion`, and it drops the most expensive ambient effects if a device can't keep up.

The original cast of twelve assistants (Claude, ChatGPT, Gemini and others) is archived, untouched, in [`archive/legacy-bots/`](archive/legacy-bots/README.md). It isn't served.

Product names belong to their respective owners. The characters link to each product's official site.
