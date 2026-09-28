"""Drop a voiceover into the GMT-Master II spot.

    python3 mix_vo.py voiceover.(wav|mp3|m4a) [score.wav] [out.wav]

The voiceover is one read of voiceover-script.txt with a clear pause between
lines. It's split on those pauses and each line is placed under its caption;
the music ducks while the voice speaks."""
import subprocess, sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
# caption start times in rolex.html; the last line lands on the logo
STARTS = [0.6, 3.4, 6.35, 9.8, 12.8, 15.8, 18.8, 21.9, 26.35]
LINES = len(STARTS)


def load(path):
    ff = __import__('imageio_ffmpeg').get_ffmpeg_exe() if len(sys.argv) < 5 else sys.argv[4]
    raw = subprocess.run([ff, '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(float) / 32768


def segments(x, gap):
    env = np.convolve(np.abs(x), np.ones(480) / 480, 'same')
    on = env > max(0.01, np.percentile(env, 95) * 0.08)
    idx = np.flatnonzero(on)
    if not len(idx): return []
    segs, s, prev = [], idx[0], idx[0]
    for i in idx[1:]:
        if i - prev > gap * SR:
            segs.append((s, prev)); s = i
        prev = i
    segs.append((s, prev))
    return [(max(0, a - 1200), min(len(x), b + 2400)) for a, b in segs if b - a > 0.15 * SR]


def main():
    vo = load(sys.argv[1])
    score_path = sys.argv[2] if len(sys.argv) > 2 else 'score.wav'
    out_path = sys.argv[3] if len(sys.argv) > 3 else 'rolex.wav'
    sr, music = wavfile.read(score_path)
    music = music.astype(float) / 32768
    for gap in np.arange(1.2, 0.2, -0.02):   # widest pause that yields exactly one chunk per line
        segs = segments(vo, gap)
        if len(segs) == LINES: break
    else:
        sys.exit(f'found {len(segs)} phrases, expected {LINES}: leave a clear pause between lines')
    voice = np.zeros(len(music))
    for (a, b), t in zip(segs, STARTS):
        s = int(t * SR); chunk = vo[a:b][:len(voice) - s]
        voice[s:s + len(chunk)] += chunk
    voice = signal.sosfilt(signal.butter(2, 90, 'highpass', fs=SR, output='sos'), voice)
    voice = voice / (np.max(np.abs(voice)) + 1e-9) * 0.85
    # duck the score under the voice: -7 dB, 40ms attack, 350ms release
    env = np.abs(voice)
    att, rel = np.exp(-1 / (0.04 * SR)), np.exp(-1 / (0.35 * SR))
    e = signal.lfilter([1 - rel], [1, -rel], np.maximum(env, signal.lfilter([1 - att], [1, -att], env)))
    duck = 1 - 0.55 * np.clip(e / 0.05, 0, 1)
    mix = music * duck[:, None] + voice[:, None] * np.array([1.0, 1.0])
    mix = np.tanh(mix * 1.05) / np.tanh(1.05) * 0.95
    wavfile.write(out_path, SR, (mix * 32767).astype(np.int16))
    print('placed', LINES, 'lines ->', out_path)


main()
