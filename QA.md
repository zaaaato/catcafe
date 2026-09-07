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

This project has been built and checked locally. It has not been published to a public domain.

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
