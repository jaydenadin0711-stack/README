# GMT-Master II — 30s spot

`gmt-master-ii.mp4` is 1080×1920 at 60fps and 30 seconds long, with an original score and on-screen captions. This is a fan/spec edit made from supplied stills and the Rolex logo. It isn't an official Rolex ad.

| Time | Shot | Transition in |
|---|---|---|
| 0–3s | Bezel | a gold 24-hour ring draws on, bezel ratchet clicks |
| 3–6s | Dial, push toward the GMT hand | zoom-through |
| 6–9.5s | Cockpit | warm light leak |
| 9.5–12.5s | Mountain sunrise | horizontal whip pan |
| 12.5–15.5s | Jubilee bracelet | gold line opens the frame |
| 15.5–18s | Oysterclasp, snap on 16.5s | vertical whip |
| 18–21.5s | Chromalight lume glowing up out of black | lights down: the score low-passes |
| 21.5–25s | Airport | cyan bloom flash |
| 25–26s | Four-cut montage on the watch ticks | hard cuts |
| 26–30s | Logo: crown shimmer, wordmark, model name | white flash |

## Voiceover

`gmt-master-ii-vo.mp4` is the same cut with narration. The voice is the Kokoro `bm_george` British male voice, run offline through sherpa-onnx. The model comes from the `n8n-nodes-ttsbro@0.1.6` npm package.

```sh
cd src
npm pack n8n-nodes-ttsbro@0.1.6 && tar xzf n8n-nodes-ttsbro-0.1.6.tgz package/kokoro-int8-en-v0_19 && mkdir -p tts && mv package/kokoro-int8-en-v0_19 tts/kokoro
pip install sherpa-onnx
python3 vo.py 9 0.92          # one clip per line -> vo/9_*.wav (the committed clips re-ran lines 2 and 4 faster)
python3 score.py && python3 mix_lines.py   # -> rolex_vo.wav, score ducked under the voice
ffmpeg -i ../gmt-master-ii.mp4 -i rolex_vo.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k ../gmt-master-ii-vo.mp4
```

To use your own recording, read `voiceover-script.txt` in one take with pauses between the lines, then run `python3 mix_vo.py take.m4a score.wav rolex_vo.wav`.

## Rebuild the picture

```sh
cd src
FPS=60 node render.mjs 0 1800 1 frames   # headless Chromium via Playwright
ffmpeg -framerate 60 -i frames/f%04d.jpg -i score.wav -c:v libx264 -crf 19 -pix_fmt yuv420p -c:a aac -b:a 256k -shortest ../gmt-master-ii.mp4
```
