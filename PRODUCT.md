# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML/CSS/JS, no framework, no build step. Hosted on GitHub Pages. Phones link to the shared screen peer-to-peer (PeerJS for signalling only, WebRTC data channels).

## Users

- Théo Von Euw, sound design teacher (Studio M, Nice), who tests the game first.
- His six third-year sound design students, playing in class in groups of 2 to 4: one shared screen (TV or projector driven by a laptop) and their own phones (iPhone and Android).
- The same students later deliver every sound of the game; the game is the commission they compose for.

## Product Purpose

Perséphone is a 90-minute investigation / escape game in French. 2091, a scientific station orbiting Mars; the players are crew woken 21 days early by HÉLIOS, the onboard AI that never lies but can stay silent. They question it, listen to the doctor's degrading logs, intercept a hidden radio message, and finally choose between evacuating with the organism or keeping the quarantine.

Success: a team plays start to finish without help, feels inside a film, and the students understand exactly where each of their sounds lives.

## Positioning

The sound of the game is made by the people who play it. Two builds share everything except sound:
- **Test build**: provisional sound and provisional synthetic voices, for Théo only.
- **Student build**: same images, no sound at all; every sound event is shown as an audio-description caption carrying the deliverable code from the brief (AMB_02, HEL_S3, FER_05…), so students are not steered by a provisional sound identity.

## Operating Context

- Shared Station screen seen and heard by everyone, controlled with mouse/trackpad (laptop on a TV).
- Phone instruments that hide nothing: the Terminal (compose questions to HÉLIOS; answers appear and are heard on the Station) and the Radio (rotate the phone flat like a dial, gyroscope; listen in the phone's speaker; "Diffuser sur la station").
- 2 players: one phone with Terminal and Radio. 3–4 players: two phones.
- A room with several people talking, laptop speakers or TV.

## Capabilities and Constraints

- Every sound uses the file codes of the brief « Perséphone - brief sound design » so the students' WAVs replace the provisional ones without code changes.
- Voice texts are fixed by the brief (HEL_, ACH_, FER_ codes); the clues 17 and 441 must stay.
- Oxygen gauge as countdown; drops with time and with useless questions.
- Two endings (evacuate / stay) plus a loss (oxygen out), each with a cinematic.
- Must run in a phone browser without install, with a drag fallback when the gyroscope is denied.

## Brand Commitments

- Visual reference fixed by Théo: the Avalon of the film *Passengers*, twenty years later: curved ribs, pearl white panels, warm golden indirect light, brass and wood, large windows on Mars, blue-lit cryo pods; worn, scratched, repaired.
- Images and videos must live in that world. The image matters as much as story and sound: "a real journey, a film".
- It must not look AI-generated in any way.
- French, vouvoiement, sober.

## Evidence on Hand

- Brief, actor texts and voice release form in `~/Desktop/COURS STUDIO M/Cours 3ème Année/Perséphone/`.
- No real sounds yet: students deliver over six weeks.
- Images, videos, provisional music and voices are generated on Théo's Windows PC (Wan2GP).

## Product Principles

1. The film comes first: interface recedes behind the image, appears only when touched.
2. Diegetic over decorative: every panel is a piece of the station, not a web widget.
3. Silence is a feature: HÉLIOS's silence and empty space carry meaning.
4. One fact, one place: what the phone shows, the Station does not duplicate.
5. Nothing that reads as a template or as generated.

## Accessibility & Inclusion

- Voices subtitled (optional in test build, always in student build).
- Readable from a sofa at 3 m on a TV; phone UI usable one-handed.
