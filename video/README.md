# NOVA — 30s motion spot

`nova-30s.mp4` is a 1080×1920 video at 60fps and 30 seconds long. It's an ad for a made-up console called NOVA, done in a console-launch motion style.

The video and the music are generated together from code, on the same 128 BPM grid (64 beats = 30s). Every cut, flash and glitch lands on a musical hit, and the audio stutters and tape-stop at 39B and 59B repeat the visual frames in the same way.

| Beats | Section |
|---|---|
| 0–8 | Boot: starfield, light line, "PRESS START" |
| 8–16 | The four shapes land, one per impact |
| 16–24 | Build: word slams, snare roll, "READY?" |
| 24–40 | Drop 1: tunnel, kaleidoscope, 3D orbit, word strobe |
| 40–48 | Breakdown: shatter in slow motion |
| 48–60 | Drop 2: hyperspace, split panels, shape wipes |
| 60–64 | Logo lockup |

## Rebuild

```sh
cd video/src
pip install numpy scipy imageio-ffmpeg
python3 music.py                       # -> nova.wav
FPS=60 node render.mjs 0 1800 1 frames # headless Chromium via Playwright
ffmpeg -framerate 60 -i frames/f%04d.jpg -i nova.wav -c:v libx264 -crf 20 \
  -pix_fmt yuv420p -c:a aac -b:a 256k -shortest nova.mp4
```

To watch a live preview with sound, open `nova.html?play` in a browser after generating `nova.wav`.
