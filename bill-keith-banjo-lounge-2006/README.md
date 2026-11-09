# Bill Keith Banjo Workshop

A replay of Bill Keith's online banjo workshop at the Banjo Lounge, recorded
**October 17, 2006**. Play the three hours of audio, and the slides, whiteboard
drawings, speaker and chat room follow along at the moments they happened. The
handouts and tab sheets are on the same page.

## Viewing it

- **On the web:** https://mikebeaumier.com/banjo-workshops/bill-keith-banjo-lounge-2006/
- **Offline:** open `index.html` in any modern browser. No server or build step
  is needed, and seeking works from disk.

Link to a moment with `?t=<seconds>`, e.g. `index.html?t=6676` for the circle of
fifths. Keyboard: Space plays and pauses, ← and → skip 15 seconds.

The folder is about 56 MB. The largest file is the 41 MB MP3, under GitHub's
100 MB per-file limit.

## What's in here

| Path | Contents |
| --- | --- |
| `index.html`, `assets/` | The player page, styles and script (plain HTML/CSS/JS) |
| `data/session.js` | Every timed event from the recording: 397 chat messages, 14 slide changes, whiteboard drawings, microphone changes |
| `media/workshop.mp3` | The session audio (2 h 59 min, 32 kbps mono) |
| `slides/` | The 14 images Bill put on the whiteboard, as shown in the session |
| `handouts/` | The 10-page handout as a PDF, plus a photo of each page |
| `tabs/` | Higher-resolution scans of the individual exercises |
| `tools/extract_session.py` | The decoder that produced `data/session.js` |

## How it was restored

The original was an iVocalize "presentation" export: a Java-applet player
(`player.jar`), the MP3, and a `presentation.bin` file holding the timeline.
Browsers no longer run Java applets, so the timeline was decoded and the player
rebuilt as a web page.

`presentation.bin` is a stream of `type, length, payload` records: audio packets,
chat lines, speaker changes, slide changes, whiteboard commands and web-page
pushes. The records carry no timestamps. Each audio packet holds 240 ms, so an
event's time is the number of audio packets before it × 0.24 s. The 44,768
packets give exactly the MP3's length. `tools/extract_session.py` documents the
whole format.

Two consequences of the format:

- The recorder only captured audio while someone was talking. Silences,
  including the intermission, are shortened, but everything stays in sync with
  the audio.
- A few whiteboard actions happened during those silences, so they have no
  length in the recording. The player treats a slide change as starting a fresh
  whiteboard, which keeps every drawing that was visible while audio played.
  Drawing colours weren't fully decoded, so all ink is drawn in red.

The original export and source files are not kept in this repository.
