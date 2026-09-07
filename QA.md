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

## 2026-09-07 — Element identities and ultimate cut-ins

- Replaced shared attack stars and rings with six distinct silhouettes and motions: flames, crystals, jagged lightning, spirals, a dark gravity core, and rocks. Normal blending retains their colors instead of washing all attacks out to white. KO stars remain.
- Ultimate impacts have dedicated compositions: flame columns, an ice-pillar enclosure, overhead lightning, a double tornado, an eclipse with inward-moving particles, and a meteor with radial ground fissures. Fivefold knockback remains.
- Added portrait/name/element/move-name ultimate cut-ins, matching card badges, and emphasized ultimate log entries. Up to two banners appear at a time; six simultaneous events all display within 3.15 seconds. Reset, hidden tabs, errors, and disposal clear pending banners and timers; reduced motion uses static banners.
- Real browser presentation checks observed all six queued names exactly once, no banners left afterward, all controls still disabled, and no horizontal overflow at 390px. Visually inspected all six ultimate impacts and desktop/mobile cut-ins. No JavaScript errors observed.
- Real WebGL move harness: all 29 checks passed, including all 24 moves, burn, paralysis, knockback, landing, and reset. The landing wait accounts for the longer fivefold arc.
- All 58 unit tests and production build passed. Added four VFX regression cases and three cut-in queue/lifecycle cases. The 100-second autonomous WebGL run passed all eight checks after the final lightning adjustment.

## 2026-09-07 — Live transition and spectator camera controls

Elemental speed follow-up: movement now uses wind 1.65, lightning 1.30, fire 0.95, dark 0.85, ice 0.68, earth 0.55 scene units/second. Wind is three times earth's base speed; slow still multiplies by 0.55 and freeze/paralysis still stop movement. All 59 unit tests, production build, and 21 live WebGL handover/round assertions passed.

Follow-up: live entry now preserves all six cat positions and headings. Elevated cats retain their jump and descend naturally. All 21 live WebGL checks passed, including exact before/after position equality; a separate elevated-cat run retained its position and completed descent. All 58 unit tests and the production build passed. Round restart formations remain unchanged.

- Secret activation loads its UI while the cafe keeps rendering, then transfers the existing scene and DOM into battle. No document reload, canvas replacement, whiteout, or loading overlay occurs. Old cafe UI listeners, timers, subscriptions, and audio are released before battle attaches its handlers.
- Added an idempotent scene handover that clears play, feeding, interaction, social behavior, and jumps while retaining the renderer, canvas, WebGL context, camera position, and target. Automatic round resets preserve the visitor's camera.
- Restored orbit dragging, zoom, view reset, fullscreen, photo capture, and day/evening controls in battle. Cat interaction buttons remain disabled. Keyboard +/-/R/F/C and photo dialog controls work alongside the scene buttons.
- Actual browser hover confirmed identical canvas, WebGL context, and performance time origin before/after activation, with no loading overlay. Browser actions confirmed exact 1.15 zoom, changed camera position after dragging, fullscreen entry/exit, and PNG photo preview. Reload returns to ordinary cafe controls; toy mode still works.
- Live WebGL handover harness: all 20 assertions passed through 100 simulated seconds and round four, including handover during care, camera preservation, released old interactions, idempotence, all six autonomous fighters, winners, context reuse, and finite room bounds.
- `npm run check`: all 58 unit tests and production build passed.

## Stronger speed contrast

- Increased wind/lightning/fire/dark/ice/earth speeds to 6/3/1.5/0.8/0.35/0.15. Battle turning responds faster for fast cats. Wind now has forty times earth's base speed.
- Real WebGL first-0.3-second net displacement measured approximately 1.00 for wind and 0.042 for earth. All 21 live battle checks, 59 unit tests, and production build passed.

## Destructible furniture

- Separated eight furniture groups (two plants, sofa, two tables, two stools, cat tree) from the room batch while retaining per-item batching. Normal cafe rendering and collision footprints remain intact.
- Projectile impacts damage nearby furniture. Ordinary hits shake props and accumulate damage; ultimates launch nearby furniture into the air, rotate it, scatter fragments, and leave persistent wreckage on its original footprint. Round reset restores exact transforms and visibility.
- Debris uses a bounded pool of 80 pieces, including reserved permanent wreckage. Reduced-motion presentation is restrained; shared room materials and geometry are never disposed or modified by the controller.
- All 66 unit tests and production build passed. New cases cover impact delivery/cancellation, proximity, accumulated damage, flight/landing, bounded repeated rounds, exact restoration, reduced motion, and resource ownership.
- Real WebGL: 32 battle checks, 18 ordinary cafe checks, and 21 live handover/continuous battle checks passed. A single ultimate visibly launched five nearby furniture items approximately three units high; inspected airborne furniture and settled wreckage. Normal feeding, social play, jumps, and toys still pass.
