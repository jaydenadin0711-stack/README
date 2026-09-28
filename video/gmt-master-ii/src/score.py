"""GMT-Master II spot — 30s score. Chords change on the picture cuts; the
watch tick runs underneath at 2 per second. Shot boundaries (seconds) match
CUTS in rolex.html."""
import json
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
DUR = 30.0
N = int(SR * DUR)
rng = np.random.default_rng(3)
L = np.zeros(N); R = np.zeros(N)
send = np.zeros((2, N))

CUTS = [0.0, 3.0, 6.0, 9.5, 12.5, 15.5, 18.0, 21.5, 25.0, 26.0, 30.0]


def mtof(m): return 440 * 2 ** ((m - 69) / 12)
def S(sec): return int(round(sec * SR))
def tv(sec): return np.arange(int(sec * SR)) / SR
def noise(sec): return rng.standard_normal(int(sec * SR))
def sos(kind, f, order=2): return signal.butter(order, np.clip(f, 20, SR / 2 - 200), btype=kind, fs=SR, output='sos')
def filt(x, kind, f, order=2): return signal.sosfilt(sos(kind, f, order), x)


def add(t, x, g=1.0, pan=0.0, rev=0.0):
    s = S(t)
    if s >= N: return
    x = x[:N - s]
    gl, gr = g * np.sqrt(.5 * (1 - pan)), g * np.sqrt(.5 * (1 + pan))
    L[s:s + len(x)] += x * gl; R[s:s + len(x)] += x * gr
    if rev:
        send[0, s:s + len(x)] += x * gl * rev; send[1, s:s + len(x)] += x * gr * rev


def sweep(x, kind, f0, f1, curve=1.0, blk=256):
    out = np.zeros_like(x); zi = None; n = len(x)
    for i in range(0, n, blk):
        p = (i / max(1, n - 1)) ** curve
        f = f0 * (f1 / f0) ** p
        s = sos('bandpass', [f / 1.3, f * 1.3]) if kind == 'bandpass' else sos(kind, f)
        if zi is None: zi = np.zeros((s.shape[0], 2))
        out[i:i + blk], zi = signal.sosfilt(s, x[i:i + blk], zi=zi)
    return out


# ---------------------------------------------------------------- voices
def piano(m, sec=3.5, vel=1.0):
    t = tv(sec); f = mtof(m); x = np.zeros_like(t)
    Bc = 0.0004
    for n in range(1, 12):
        fn = n * f * np.sqrt(1 + Bc * n * n)
        if fn > SR / 2.2: break
        amp = (1 / n ** 1.1) * (0.6 + 0.4 * vel)
        dec = 1.2 + n * 0.9 + f / 400
        x += amp * np.sin(2 * np.pi * fn * t + rng.random() * 6) * np.exp(-t * dec)
    ham = filt(noise(0.02), 'bandpass', [800, 5000]) * np.linspace(1, 0, S(0.02)) * 0.15
    x[:len(ham)] += ham
    x *= np.minimum(1, t / 0.003)
    return x * 0.22 * vel


def strings(notes, sec, cutoff=1800, att=1.2, rel=1.2):
    t = tv(sec); x = np.zeros_like(t)
    for m in notes:
        for d in (-0.08, 0, 0.07):
            f = mtof(m) * 2 ** (d / 12) * (1 + 0.003 * np.sin(2 * np.pi * 5.2 * t + rng.random() * 6))
            ph = np.cumsum(f) / SR
            x += 2 * (ph % 1) - 1
    x = filt(x, 'lowpass', cutoff, 4)
    env = np.minimum(1, t / att) * np.minimum(1, (sec - t) / rel).clip(0)
    return x * env * 0.05


def sub(m, sec):
    t = tv(sec)
    return np.sin(2 * np.pi * mtof(m) * t) * np.minimum(1, t / .3) * np.minimum(1, (sec - t) / .5).clip(0) * 0.35


def tick(hi=True):
    t = tv(0.04)
    click = filt(noise(0.04), 'highpass', 5000) * np.exp(-t * 400)
    ping = np.sin(2 * np.pi * (3400 if hi else 2700) * t) * np.exp(-t * 180)
    return (click * 0.5 + ping * 0.6) * 0.35


def ratchet_click():
    t = tv(0.03)
    return (filt(noise(0.03), 'bandpass', [2000, 7000]) * np.exp(-t * 300) + np.sin(2 * np.pi * 4700 * t) * np.exp(-t * 250) * .4) * 0.3


def clasp():
    t = tv(0.5); x = np.zeros_like(t)
    for off, g in ((0, 1.0), (0.045, 0.7)):
        s = S(off); tt = t[:len(t) - s]
        x[s:] += (filt(noise(len(tt) / SR), 'bandpass', [1500, 8000]) * np.exp(-tt * 180) + sum(np.sin(2 * np.pi * f * tt) for f in (2150, 3310, 5230)) * np.exp(-tt * 18) * 0.08) * g
    return x * 0.6


def bell(m, sec=4.0):
    t = tv(sec); f = mtof(m)
    mod = np.sin(2 * np.pi * f * 2.76 * t) * 1.8 * np.exp(-t * 2)
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 1.1) * 0.25


def whoosh(sec, f0=400, f1=4000, g=1.0):
    x = sweep(noise(sec), 'bandpass', f0, f1, 1.2)
    t = np.linspace(0, 1, len(x))
    return x * np.sin(np.pi * t) ** 2 * 0.5 * g


def boom(sec=3.0):
    t = tv(sec); f = 32 + 50 * np.exp(-t * 5)
    return np.tanh(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.3) * 1.6) * 0.8


def soft_kick():
    t = tv(0.6); f = 48 + 70 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * 0.7


def riser(sec):
    t = tv(sec)
    n = sweep(noise(sec), 'bandpass', 300, 9000, 2.0) * (t / sec) ** 2.2
    return n * 0.35


def reverse_swell(sec=1.2):
    t = tv(sec)
    x = filt(noise(sec), 'highpass', 3000) * np.exp(-t * 2.2)
    return x[::-1] * 0.4


def shimmer(sec=2.0, base=86):
    out = np.zeros(S(sec))
    for i, m in enumerate([base, base + 4, base + 7, base + 12, base + 16, base + 19]):
        s = S(i * 0.07); b = bell(m, sec)[:len(out) - s]
        out[s:s + len(b)] += b * 0.5
    return out


# ---------------------------------------------------------------- score
# D minor: Dm  Bb  F  C  Dm  Bb  (lights down)  Gm-A build  -> D major
CH = {
    'Dm': [50, 57, 62, 65], 'Bb': [46, 53, 58, 62], 'F': [53, 57, 60, 65], 'C': [48, 55, 60, 64],
    'Gm': [55, 58, 62, 67], 'A': [57, 61, 64, 69], 'D': [50, 57, 62, 66, 69],
}
ROOT = {'Dm': 38, 'Bb': 34, 'F': 41, 'C': 36, 'Gm': 43, 'A': 45, 'D': 38}
plan = [('Dm', 0, 3), ('Bb', 3, 6), ('F', 6, 9.5), ('C', 9.5, 12.5), ('Dm', 12.5, 15.5), ('Bb', 15.5, 18.0)]
for ch, a, b in plan:
    add(max(0, a - 0.35), strings(CH[ch], b - a + 1.2, 1500 + 200 * (a > 8), att=0.9, rel=1.0), 1.0, rev=0.5)
    add(a, sub(ROOT[ch], b - a + .3), 0.7)

# piano: sparse motif, two-note "two time zones" figure on shot B
add(0.5, piano(74, 4, .7), 1, -.2, .6)
add(1.5, piano(69, 4, .5), 1, .2, .6)
add(3.4, piano(70, 4, .8), 1, -.2, .6)          # "This one..."
add(4.4, piano(77, 4, .9), 1, .2, .6)           # "...tells two" (two notes)
add(4.9, piano(74, 4, .7), 1, .25, .6)
for i, m in enumerate([72, 77, 81, 79]): add(6.3 + i * .75, piano(m, 3.5, .6 + .1 * (i == 2)), 1, (i - 1.5) * .3, .6)
for i, m in enumerate([76, 79, 84, 83, 79]): add(9.6 + i * .55, piano(m, 3.5, .65), 1, (i - 2) * .25, .6)
for i, m in enumerate([74, 77, 81, 86]): add(12.6 + i * .7, piano(m, 3.2, .6), 1, (i - 1.5) * .3, .6)
for i, m in enumerate([74, 77, 82]): add(15.6 + i * .6, piano(m, 3.2, .55), 1, (i - 1) * .3, .6)

# watch tick: every half second, silent during the lights-down moment's first beat
for k in range(0, 52):
    t = 0.5 + k * 0.5
    if 25.0 <= t < 26.0: continue
    g = 0.9 if not (18.0 <= t < 21.5) else 1.3
    add(t, tick(k % 2 == 0), g, 0.15 if k % 2 else -0.15)

# bezel ratchet as the bezel rotates on shot A (1.0 - 2.4s, 24 clicks)
for i in range(24): add(1.0 + i * 0.06, ratchet_click(), 0.55 + 0.3 * (i % 2), 0.3)
# cockpit: distant jet pass
add(6.0, whoosh(3.4, 150, 700, 1.0) * 0.8, 1.0, -.4, .3)
add(6.6, filt(noise(2.6), 'lowpass', 300) * np.hanning(S(2.6)) * .12, 1.0, .4)
# transitions
for t, sec, a, b in ((2.75, .5, 500, 5000), (5.75, .5, 600, 6000), (9.25, .45, 800, 7000), (12.25, .5, 500, 5000), (15.25, .5, 800, 7000)):
    add(t, whoosh(sec, a, b), 0.55, 0, .2)
# jubilee shimmer
add(12.7, shimmer(2.5, 88), 0.5, .2, .7)
# clasp snap on the visual flash
add(16.5, clasp(), 1.2, 0, .3)
# lights down (18.0): everything dips; glassy high pad + low drone
add(18.0, strings([74, 81, 86], 3.8, 3500, att=1.5, rel=1.2) * .8, 1, rev=.8)
add(18.0, sub(38, 3.6), 0.5)
add(18.0, boom(2.5) * .35, 1, rev=.3)
add(19.8, bell(93, 3), 0.35, .4, .8)
add(20.4, bell(98, 3), 0.25, -.4, .8)
# build 21.5 - 26: Gm -> A, heartbeat kick, riser, reverse swell
add(21.2, strings(CH['Gm'] + [74], 2.3, 2200, att=.6, rel=.4), 1.2, rev=.5)
add(23.3, strings(CH['A'] + [76], 2.9, 3200, att=.5, rel=.3), 1.4, rev=.5)
add(21.5, sub(43, 1.9), 0.8); add(23.4, sub(45, 2.6), 0.9)
for t in (21.5, 22.5, 23.5, 24.5, 25.0, 25.25, 25.5, 25.75): add(t, soft_kick(), 0.9 if t < 25 else 0.7)
for i, m in enumerate([70, 74, 79, 76, 73, 76, 81, 85]): add(21.6 + i * .42, piano(m, 2.5, .6), 1, (i % 2 - .5) * .5, .5)
add(22.5, riser(3.5), 1.0)
add(24.8, reverse_swell(1.2), 1.0)
for t in (25.0, 25.25, 25.5, 25.75): add(t, tick(True) * 2.2, 1.0, 0, .3)

# END 26: resolve to D major, boom, crown shimmer, bell
add(26.0, boom(3.5), 1.0, 0, .4)
add(25.9, strings(CH['D'] + [74, 78], 4.1, 2600, att=.25, rel=2.0), 1.4, rev=.8)
add(26.0, sub(38, 4.0), 0.8)
for i, m in enumerate([62, 66, 69, 74, 78]): add(26.0 + i * .09, piano(m, 4, .8), 1, (i - 2) * .2, .8)
add(26.0, bell(86, 4), 0.6, 0, .9)
add(26.5, shimmer(3.0, 90), 0.55, 0, .9)   # crown sweep
add(27.4, bell(81, 2.6), 0.35, .3, .9)     # "GMT-MASTER II"

# ---------------------------------------------------------------- mix
mix = np.vstack([L, R])
ir_len = S(3.2); irt = np.arange(ir_len) / SR
ir = np.vstack([filt(rng.standard_normal(ir_len), 'lowpass', 5000) * np.exp(-irt * 1.8) for _ in range(2)]) * 0.045
wet = np.vstack([signal.fftconvolve(send[c], ir[c])[:N] for c in range(2)])
mix = mix + wet

# lights-down: low-pass the whole bus 18.0 -> 21.2, then open back up
seg0, seg1 = S(18.0), S(21.5)
for c in range(2):
    x = mix[c, seg0:seg1]
    closed = filt(x, 'lowpass', 900)
    t = np.linspace(0, 1, len(x))
    w = np.clip(np.minimum(t / 0.05, (1 - t) / 0.12), 0, 1)
    mix[c, seg0:seg1] = x * (1 - w) + closed * w

mix = np.vstack([filt(mix[c], 'highpass', 30) for c in range(2)])
fi = S(0.2); mix[:, :fi] *= np.linspace(0, 1, fi)
fo = S(1.6); mix[:, -fo:] *= np.linspace(1, 0, fo) ** 1.5
mix = mix / np.percentile(np.abs(mix), 99.95) * 0.9
mix = np.tanh(mix * 1.1) / np.tanh(1.1) * 0.89
wavfile.write('score.wav', SR, (mix.T * 32767).astype(np.int16))
print('ok', 20 * np.log10(np.sqrt((mix ** 2).mean())))
for a, b in zip(CUTS[:-1], CUTS[1:]):
    s = mix[:, S(a):S(b)]; print(f'{a:5.1f}-{b:5.1f}', round(20 * np.log10(np.sqrt((s ** 2).mean()) + 1e-9), 1))
