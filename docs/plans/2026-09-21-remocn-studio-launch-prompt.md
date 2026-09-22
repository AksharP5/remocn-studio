# Remocn Studio launch video — production prompt

Create an editable Remotion launch video for Remocn Studio, intended for X / Twitter. The concept: we create this very launch video inside Remocn Studio. The same recognizable title and composition must appear in the editor, change in response to prompts, and become the finished video.

Use 1920 × 1080, 16:9, 30 fps, approximately 28.2 seconds. Make a working composition and preview, with separate editable scenes, text, transitions, footage and audio. Use the existing project conventions. Treat the Remocn Studio application repository as a read-only reference for the product UI and assets.

## Assets

Room footage:
/Users/dev_wandry/Downloads/ElevenLabs_video_seedance-2-5_Photorealistic,_2026-09-21T15_20_41.mp4

Selected exit footage:
/Users/dev_wandry/Downloads/ElevenLabs_video_gemini-omni-flash-1-1_Обратное видео _2026-09-21T16_16_38.mp4

The exit clip is 10 seconds, 1280 × 720, 24 fps. It shows the person standing, closing the laptop lid, and leaving. The user approved this clip as a definite ending with a closed MacBook, without a loop. Treat it as a separate final room shot; use its existing setting and framing.

Provisional music excerpt, already trimmed to approximately 28.194 seconds:
/Users/dev_wandry/projects/opensource/remocn-studio/output/launch-video/audio/remocn-launch-music-candidate-28s.mp3

Full music source, if the excerpt needs adjusting:
/Users/dev_wandry/Downloads/Remocn_Launch_2026-09-21T160436.mp3

App icon:
/Users/dev_wandry/projects/opensource/remocn-studio/src-tauri/app-icon.png

Actual product UI reference:
/Users/dev_wandry/projects/opensource/remocn-studio

Visual pacing references:
/Users/dev_wandry/Downloads/1kVV10wSBixB60nN.mp4
/Users/dev_wandry/Downloads/rFjdmU2tLYjaZmrG.mp4

Import the required media into this video's assets so the composition can render reliably. Inspect the supplied material before building. If an asset is inaccessible, identify its exact filename and continue with the available material.

## Visual direction

Headlines: Bricolage Grotesque Medium, font-weight 500. Load the actual font. Letter spacing −0.025em; line height 1.025; base size 144px at 1080p. Use sentence case and one or two lines. Keep this typography inside the video scenes; use the product's actual typography when depicting its UI.

Palette:
- Background: #141316.
- Secondary surfaces: #232127.
- Main text: #F5F2EC.
- Secondary text: #AAA6B0.
- Graphic accents: #7C3AED.
- Highlighted words on dark backgrounds: #B9A3FF.

Set “We needed a” in warm white and “launch video.” in light violet, left aligned on two lines. Keep the room footage's natural warm lighting. Use the real app icon and a recognizable macOS Dock.

## Editing rhythm

Keep actions flowing directly into their consequences. Small click/selection inserts can take 0.2–0.4 seconds; short prompts need approximately 1.2–1.6 seconds to read once fully visible. Allow about 2–2.5 seconds for the complete initial prompt. After a visible edit, allow only 0.4–0.7 seconds to recognize the change, then continue moving. Cut out agent waiting time and rendering progress. Vary shot lengths and camera scale.

Use the supplied music excerpt provisionally. Signal analysis suggests approximately 136 BPM and a strong energy increase around 3.55 seconds into the excerpt. Align the completion of the opening Genie transition near this moment, then refine timing against the actual audio. This analysis has not confirmed vocals or musical phrasing; the excerpt still needs an intentional ending in the final mix.

## Sequence

0.00–2.10 — Room and occlusion.
Use approximately source 0.30–2.90 seconds of the room footage at 1.25× speed; adjust the exact trim to the movement. The open MacBook faces the camera in the center of a real, warm workspace. A person enters from the left and sits with their back to the viewer. Their body obscures the laptop screen; the laptop lid remains open. Cut while the person is still moving, near maximum screen occlusion. The source reaches this point around 2.85–2.95 seconds. Replace the photo editor visible on the laptop screen with the macOS desktop used in the next shot, preserving the person's occlusion with a mask.

2.10–2.80 — Dock.
Hard cut on a musical accent to a close-up of the macOS Dock. The cursor is already close to the Remocn Studio icon: brief hover, visible app label, click. Keep the cursor travel short.

2.80–3.55 — Genie.
Expand the Studio window from its Dock icon using a recognizable macOS Genie deformation. The window stretches from its Dock anchor and resolves into the full application. Finish near the music's energy increase and continue directly into the preview scene.

3.55–5.50 — Opening title.
Push into the preview and reveal:
“We needed a”
“launch video.”
Animate the words quickly into a readable composition. This exact title will be edited later.

5.50–9.50 — Create the video.
Move to a close-up of the initial chat prompt:
“Create a launch video for Remocn Studio.”
Show send, brief creation activity, and the familiar scene appearing in the preview. Establish that this is the same project and video the viewer is watching. Use authentic screen recordings when available. Otherwise, build an animated reconstruction grounded in the actual product UI and identify that reconstruction in the completion report. Preserve the real layout and available controls.

9.50–12.80 — Edit the title.
Activate Inspect, select the title, include the selected element in the composer, and show:
“Make this bigger.”
On a musical accent, change the title from 96px to 144px. Keep font weight 500, color and alignment consistent so the size change is clear. Hold recognition for approximately half a second, then transition immediately.

12.80–16.00 — Edit the motion.
Show:
“Make the motion smoother.”
Send, then show the updated title entrance with a clearly smoother finish. Show the revised animation once; its movement continues into the next shot.

16.00–20.00 — Finished result.
Expand the updated preview to fill the frame. Show three or four brief views of the finished composition: the enlarged title, its motion, and the overall layout. Use fragments of approximately 0.6–1.2 seconds, connected through movement. Return into the Studio preview at the end. Keep the result recognizable as the project we just edited.

20.00–21.00 — Export.
Click Export and cut through the wait to the finished result.

21.00–22.50 — Signature.
Display inside the video scene:
“Made in”
“Remocn Studio.”
Use warm white for the first line and light violet for the product name. Begin the outward camera movement while the title remains readable. The desired vocal treatment is exactly one quiet, intelligible spoken “Remocn” around this moment. Check whether the supplied audio already contains it before adding anything. If a suitable voice asset is unavailable, leave an editable cue and report the missing asset.

22.50–23.20 — Exit the screen.
Continue the pullback already started during the signature. Collapse the Studio window into the Dock with a quick reverse Genie effect, then transition into the supplied exit footage as the person starts standing. Match the digital desktop to the visible laptop screen in this final shot, using screen replacement and foreground masking where needed. Keep the motion continuous and avoid a desktop hold.

23.20–28.20 — Close the MacBook and finish.
Use approximately source 2.00–8.20 seconds of the selected exit footage at about 1.25× speed, giving roughly five seconds. Refine the trim so the person starts standing immediately, closes the lid, then leaves. Omit the initial seated wait and most of the empty-room tail. Preserve the full lid-closing action and natural movement; finish on the closed MacBook with only a few frames after the person clears the shot. This is the ending, with no return to the opening. Do not add a website URL or separate CTA card.

Keep the exit trim and playback speed editable. The approximately 28.2-second total is a working target; adjust the final shot slightly if needed to preserve the action without a long static hold.

## Sound and delivery

Use the supplied music and restrained interface sound effects: hover/click where appropriate, selection, send, Export, and a related pair of short sounds for Genie opening and closing. Add a subtle lid-close sound synchronized to contact. Leave room in the mix for these actions. Use the room clips' audio only if it contributes suitable clean movement sounds.

There is no narrated explanation. All visible copy is English. The sole intended spoken word is “Remocn,” once, mixed quietly but intelligibly. Avoid duplicating it if it is already present in the music. Give the music a deliberate ending: use a suitable musical accent near the lid closing, then a short tail or controlled fade during the person's departure, ending by the final frame. Check the phrase by listening and adjust the source edit if needed; avoid an arbitrary mid-note cutoff.

Expose the scene timings, copy, type size, tracking, line height, palette, music trim/gain/fade and sound-effect gains as editable parameters. Preview the full sequence, check text at a small feed size, and verify cuts against the music. Check the transition into the final room shot, the complete lid-closing action, and the final audio tail. Deliver the working preview and a concise list of any missing assets or provisional scenes.
