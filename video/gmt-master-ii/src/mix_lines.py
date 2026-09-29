"""Place per-line voiceover clips (vo/9_0.wav ... vo/9_8.wav) under their captions and duck the score."""
import numpy as np
from scipy import signal
from scipy.io import wavfile
SR = 48000
STARTS = [0.6, 3.4, 6.35, 9.8, 12.8, 15.8, 18.8, 21.9, 26.35]
_, music = wavfile.read('score.wav'); music = music.astype(float) / 32768
voice = np.zeros(len(music))
for i, t in enumerate(STARTS):
    sr, x = wavfile.read(f'vo/9_{i}.wav'); x = x.astype(float) / 32768
    x = signal.resample_poly(x, SR, sr)
    s = int(t * SR); voice[s:s + len(x)] += x[:len(voice) - s]
sos = lambda k, f: signal.butter(2, f, k, fs=SR, output='sos')
voice = signal.sosfilt(sos('highpass', 75), voice)
voice += 0.35 * signal.sosfilt(sos('lowpass', 220), voice)          # chest warmth
voice += 0.12 * signal.sosfilt(sos('highpass', 5500), voice)        # air
# gentle compression
env = signal.lfilter([0.002], [1, -0.998], np.abs(voice)); pk = env.max()
voice *= np.where(env > pk * .3, (pk * .3 / np.maximum(env, 1e-9)) ** 0.4, 1)
voice /= np.abs(voice).max()
# small room
n = int(1.2 * SR); ir = np.random.default_rng(1).standard_normal(n) * np.exp(-np.arange(n) / SR * 5)
ir = signal.sosfilt(sos('lowpass', 4000), ir) * 0.02
wet = signal.fftconvolve(voice, ir)[:len(voice)]
v = voice * 0.8 + wet * 0.8
# duck score -8 dB under the voice
env = np.abs(voice); att, rel = np.exp(-1 / (.03 * SR)), np.exp(-1 / (.4 * SR))
e = signal.lfilter([1 - rel], [1, -rel], signal.lfilter([1 - att], [1, -att], env))
duck = 1 - 0.6 * np.clip(e / 0.04, 0, 1)
mix = music * duck[:, None] + v[:, None] * 0.82
mix = np.tanh(mix * 1.05) / np.tanh(1.05); mix *= 0.97 / np.abs(mix).max()
wavfile.write('rolex_vo.wav', SR, (mix * 32767).astype(np.int16))
for a, b in [(0, 3), (6, 9.5), (18, 21.5), (26, 30)]:
    seg = mix[int(a * SR):int(b * SR)]; vs = v[int(a * SR):int(b * SR)] * .82
    print(f'{a}-{b}s  mix {20*np.log10(np.sqrt((seg**2).mean())):.1f} dB  voice {20*np.log10(np.sqrt((vs**2).mean())+1e-9):.1f} dB')
