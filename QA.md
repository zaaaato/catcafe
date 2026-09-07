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
