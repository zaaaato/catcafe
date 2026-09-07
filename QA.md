# Verification record — 2026-09-07

## Automated checks

`npm run check` runs 19 Node tests and a production Vite build. The tests cover corrupted or unavailable storage, bounds, affection cooldowns, restoration without autoplay, cross-tab settings, audio initialization, playback rejection, rapid toggles, visibility transitions, stale async responses, and cleanup.

The real-WebGL scene harness verified all six rest/movement poses, sofa and cat-tower occupancy, the complete eight-stage jump lifecycle, descending before joining food, all six cats reaching food, the stalking/wiggle/pounce/search sequence, brushing, sniffing before eating, quality changes, reduced motion, nonempty PNG capture, and disposal followed by recreation. A separate scene run switched from each of the eight jump stages into interaction or feeding; all eight completed safely.

Reproduce with `npm run test:scene:prepare`, `npm run dev`, then `/tests/scene-harness.html` and `await cafeHarness.runSmoke()` in the developer console.

## Browser checks

- Desktop 1440 px and mobile 390 px layouts, including 390 × 568 settings-dialog scrolling.
- Cat selection, direct petting, drag-based petting/brushing, direct feeding, and keyboard interaction.
- Locked camera while stroking, live reactions, affection updates, profiles and observation notebook.
- Photo preview and PNG download.
- Sound toggle, three soundscapes, volume, all quality levels and reduced motion.
- Settings restored after revisiting; audio always initially off.
- Focus returning after closing dialogs, readable button labels and no horizontal overflow.
- WebGL context-loss and unsupported-WebGL fallback with reload action.
- Storage-access refusal and quota exhaustion, with honest session-only messages.

Browser automation used Chromium on this Mac. Physical mobile-device and Safari/Firefox coverage are not claimed.

## Audio signal checks

An OfflineAudioContext run rendered each of the three soundscapes for six seconds at maximum volume, both alone and with all effects. All samples were finite, peak remained below 0.220 (no clipping), and environment RMS was approximately −30 to −32 dBFS after balancing. This is a numerical signal check; subjective listening on multiple headphones/speakers was not performed.

## Issues resolved during verification

- Furniture-corner pathfinding could leave cats stepping in place.
- Neighbor-repulsion around the food dish could prevent the last cat arriving.
- Stroking could rotate the camera through OrbitControls.
- An old rejected audio-resume request could override a newer ON request.
- Storage-unavailable descriptions and audio-start-failure messaging were misleading.

The initial checks above were local. The project is now published at https://zaaaato.github.io/catcafe/.

## Additional interaction polish

A further browser pass checked the hand/brush/food pointer indicator, pointer-down feedback, hiding on leave/cancel, and disabling the indicator with reduced motion. The interaction camera foreground now makes nearby cats walk gently to the side without moving the selected cat or interrupting airborne jumps. An observed case moved Goma aside while Chai stayed fixed; all six cats subsequently reached food after interaction ended. The full real-WebGL smoke sequence (179.9 simulated seconds) passed all 11 assertions again.

## 2026-09-07 — Toy handling and feeding contact

- Centered the rolling ball geometry on its rotation origin and placed its full radius above the rug. Manual movement stays within the clear play area.
- Added pointer capture for ball dragging, camera suspension during dragging, release/cancel/blur cleanup, arrow-key movement, and contextual PC/mobile instructions.
- Feeding now tracks an actual food mesh with the mouth landmark, lowers the shoulders with planted-foot IK, sniffs before eating, and smoothly restores the head afterward.
- `npm run check`: 19 unit tests and production build passed.
- Real WebGL deterministic smoke: 15 assertions passed, including all six cats reaching communal food, mouth contact with communal and individual snacks, ball clearance, manual position persistence, hunting, elevated rests, brushing, quality settings, capture, and disposal.
- Visually inspected communal feeding and a close-up of individual feeding. Settled mouth-to-food distance was approximately 0.002–0.005 scene units.

## 2026-09-07 — Expressive tails

- Added continuous tail bending with delayed motion toward the tip and intermittent tip flicks. Sitting, sleeping, walking, affection and hunting use different amplitudes; phase integration keeps transitions smooth even after long sessions.
- CPU pose blending avoids stale GPU morph textures and keeps the root attached, tip aligned, normals normalized, and deformations noncumulative. Existing geometry/materials are reused.
- `npm run check`: 25 unit tests passed, including six tail deformation regressions; production build passed.
- Real WebGL smoke: 16 assertions passed, including six moving tails and existing food contact, jumps, hunting and interactions. Communal feeding allows a bounded settling period for different starting routes.
- Compared close-up frames of a seated, petted cat: the tail visibly bends sideways while its height stays unchanged. No browser errors.

## 2026-09-07 — Cat-to-cat play

- Added one voluntary social pair at a time in relax mode: approach, nose greeting, alternating paw invitations, then a short chase along checked paths. Sleep, jumps and direct care exclude participants; modes and user care cancel immediately. Recent pairs have a small priority penalty.
- Integrated facing, planted-foot IK and raised alternating paws with existing movement. The controller never teleports roots and chase followers keep their distance.
- The observation notebook now discovers three social gestures, with a dynamic total of ten and updated help.
- Fixed an exposed dining deadlock: assign bowl seats in current angular order, choosing the shortest rotation, so cats do not exchange places through one another after play.
- `npm run check`: 32 unit tests and production build passed. Seven social unit cases cover phase progression, actual movement stopping radius, scale-aware nose spacing, exclusions, cancellation, timeouts, unsafe paths and pair rotation.
- Real WebGL regression: 18 assertions passed. Visually inspected the greeting/paw pair; both cats moved during chase (approximately 0.77 and 1.01 scene units over 1.5 seconds). Direct care immediately cancelled social play. Existing food contact, toy control, tails, jumps and capture remained functional.

## 2026-09-07 — Secret elemental battle arena

Historical manual-mode checks; superseded by the autonomous battle royale below.

- The cafe logo is a hidden entrance: hover for 1.3 seconds to start its shimmer/shake, continue to 4.2 seconds to enter. Touch long-press and keyboard holding also work. Leaving, lifting, moving a touch, hiding the tab, or losing focus cancels. Reduced-motion users receive a static glow.
- Activation uses a one-shot history-state flag followed by a same-URL reload. The entry consumes the flag before mounting the battle UI; reload/return restores the ordinary cafe. No dedicated battle path or public navigation item is generated.
- Six elements and 24 named moves: three regular moves and one ultimate per cat. HP, energy, independent cooldowns, burn damage, freezing, paralysis, slow and knockback are isolated from cafe persistence. Down cats recover after five seconds.
- Battle effects use a capped reusable pool, status particles and safe knockback arcs. Ultimate wind visibly lifts and displaces its target; reset clears effects and positions. Selection rings and pair framing distinguish attacker and target.
- Unit coverage includes all 24 moves, cooldowns, invalid input, effect timing, energy, knockouts, snapshot isolation, complete reset, one-shot activation and hover/touch cancellation.
- Real WebGL battle harness: 29 checks passed, including all moves, paralysis, continued burn, lift/push/landing, and reset. Ordinary cafe regression: 18 checks passed with battle state null.
- Actual browser hover: charging appears, leaving cancels, sustained hover enters at the same URL, and reload exits. Battle UI checked at desktop and 390px widths; ultimate casting updates HP/energy/cooldowns and logs. No JavaScript errors observed.

## 2026-09-07 — Autonomous six-cat battle royale

- Replaced manual commands with six independent fighters choosing targets, moving, and using the existing 24 moves. Spectators have no battle or camera controls. The original cafe headline remains.
- Eliminated cats roll onto their side and stay down until the next round. The last survivor wins; an eight-second intermission starts a fresh round automatically. Cartoon impact stars, knockout stars, stronger knockback, and winner confetti accompany the fight.
- Changed the secret entrance hint to `力が欲しいか、、、`.
- `npm run check`: all 51 unit tests and production build passed. Twelve seeded engine matches finish with every cat attacking and no mid-round revival.
- Real WebGL royale harness: all seven checks passed across 100 simulated seconds, reaching round four. Covered six autonomous attackers, ordinary/ultimate moves, movement, sideways collapse, last-survivor finish, automatic restart, and finite positions within the room.
- Ordinary cafe WebGL regression: all 18 assertions passed, including feeding contact, toys, elevated rests, social play, tails, and disposal.
- Actual desktop browser: sustained logo hover enters on the same URL, normal headline remains, no command buttons exist, and HP/logs update without input. Visually inspected the spectator screen and sideways fallen cats; no JavaScript errors observed.

## 2026-09-07 — Fivefold spectacle and immediate start

- Removed the countdown from initial entry and subsequent rounds. The first update immediately produces autonomous movement intents; winner intermissions remain eight seconds.
- Multiplied projectile, star, and ring sizes and particle scattering speeds by five. Normal/ultimate knockback now travels up to 6/9.5 units with arcs of 2.5/5.5 units, subject to obstacle clearance. Increased camera headroom for airborne cats.
- Kept the particle pool bounded at 140 and preserved reduced-motion settings. Real Three.js checks measured exact unobstructed distances of 6 and 9.5, a fivefold projectile size, wall stopping, and all six projectiles arriving even with a saturated cosmetic pool.
- Real WebGL royale regression: all eight checks passed, including immediate start, autonomous attacks, side collapse, complete rounds, and room bounds. Visually inspected the amplified effects.

- Normal and battle modes now share one cafe shell. The original buttons, profile cards, and inputs remain visible but disabled during battle; canvas and links cannot accept interaction. Desktop and 390px browser checks confirmed all controls disabled, six original cat cards retained, no countdown, no horizontal overflow, and no JavaScript errors. Normal-mode toy controls still work. All 51 unit tests and production build passed.
