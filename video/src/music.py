"""NOVA — 30s soundtrack. 128 BPM, F minor, 64 beats. Every event sits on the
same beat grid the visuals use (B = 0.46875s)."""
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
BPM = 128
B = 60 / BPM
DUR = 30.0
N = int(SR * DUR)
rng = np.random.default_rng(7)

L = np.zeros(N)
R = np.zeros(N)
send = np.zeros((2, N))  # reverb send


def mtof(m):
    return 440 * 2 ** ((m - 69) / 12)


def at(beat):
    return int(round(beat * B * SR))


def add(buf, start, x, gain=1.0, pan=0.0, rev=0.0):
    """Mix mono x into stereo bus at sample `start`."""
    if start >= N:
        return
    x = x[: N - start]
    if start < 0:
        x = x[-start:]
        start = 0
    gl = gain * np.sqrt(0.5 * (1 - pan))
    gr = gain * np.sqrt(0.5 * (1 + pan))
    L[start:start + len(x)] += x * gl
    R[start:start + len(x)] += x * gr
    if rev:
        send[0, start:start + len(x)] += x * gl * rev
        send[1, start:start + len(x)] += x * gr * rev


def tvec(sec):
    return np.arange(int(sec * SR)) / SR


def sos(kind, f, order=2):
    f = np.clip(f, 20, SR / 2 - 100)
    return signal.butter(order, f, btype=kind, fs=SR, output="sos")


def filt(x, kind, f, order=2):
    return signal.sosfilt(sos(kind, f, order), x)


def sweep_filter(x, kind, f0, f1, block=256, curve=2.0, q_band=None):
    """Time-varying filter from f0 to f1 (exponential)."""
    out = np.zeros_like(x)
    zi = None
    n = len(x)
    for i in range(0, n, block):
        p = (i / max(1, n - 1)) ** curve
        f = f0 * (f1 / f0) ** p
        if kind == "bandpass":
            s = sos("bandpass", [f / 1.25, f * 1.25])
        else:
            s = sos(kind, f)
        if zi is None or zi.shape[0] != s.shape[0]:
            zi = np.zeros((s.shape[0], 2))
        out[i:i + block], zi = signal.sosfilt(s, x[i:i + block], zi=zi)
    return out


def noise(sec):
    return rng.standard_normal(int(sec * SR))


def saw(freq, sec, phase=0.0):
    t = tvec(sec)
    ph = (phase + np.cumsum(np.broadcast_to(freq, t.shape)) / SR) % 1.0
    return 2 * ph - 1


def adsr(n, a=0.005, d=0.1, s=0.7, r=0.1, sec=None):
    a_n, d_n, r_n = int(a * SR), int(d * SR), int(r * SR)
    hold = max(0, n - a_n - d_n - r_n)
    env = np.concatenate([
        np.linspace(0, 1, a_n, endpoint=False),
        np.linspace(1, s, d_n, endpoint=False),
        np.full(hold, s),
        np.linspace(s, 0, r_n),
    ])
    return np.pad(env, (0, max(0, n - len(env))))[:n]


# ---------------------------------------------------------------- drums
def kick(big=False):
    t = tvec(0.5 if not big else 1.2)
    f = 45 + 160 * np.exp(-t * 28) + (40 * np.exp(-t * 8) if big else 0)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * (6 if not big else 2.8))
    click = filt(noise(0.01), "highpass", 2500) * 0.6
    body[: len(click)] += click * np.linspace(1, 0, len(click))
    return np.tanh(body * 2.2) * 0.9


def clap():
    t = tvec(0.35)
    n = filt(noise(0.35), "bandpass", [900, 5000])
    env = np.zeros_like(t)
    for k, off in enumerate([0, 0.011, 0.022]):
        env += (t >= off) * np.exp(-(t - off).clip(0) * (80 if k < 2 else 16))
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.4
    return (n * env + tone) * 0.7


def snare():
    t = tvec(0.22)
    n = filt(noise(0.22), "bandpass", [1500, 9000]) * np.exp(-t * 22)
    tone = np.sin(2 * np.pi * 210 * t) * np.exp(-t * 35)
    return n * 0.8 + tone * 0.5


def hat(open_=False):
    sec = 0.28 if open_ else 0.05
    t = tvec(sec)
    n = filt(noise(sec), "highpass", 7500)
    return n * np.exp(-t * (14 if open_ else 90)) * 0.5


def crash():
    t = tvec(2.5)
    n = filt(noise(2.5), "highpass", 4000)
    ring = sum(np.sin(2 * np.pi * f * t) for f in (3120, 4470, 5830, 7210)) * 0.05
    return (n * 0.6 + ring) * np.exp(-t * 1.6)


def impact():
    """Cinematic hit: sub boom + noise blast + metallic ring."""
    t = tvec(2.2)
    f = 30 + 90 * np.exp(-t * 6)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.9)
    blast = filt(noise(2.2), "lowpass", 3000) * np.exp(-t * 7) * 0.6
    ring = sum(np.sin(2 * np.pi * f * t + i) for i, f in enumerate((233, 347, 521, 780))) * np.exp(-t * 2.5) * 0.08
    return np.tanh((boom * 1.4 + blast + ring) * 1.5) * 0.9


def whoosh(sec=0.6, up=True):
    n = noise(sec)
    f0, f1 = (300, 9000) if up else (9000, 300)
    x = sweep_filter(n, "bandpass", f0, f1, curve=1.5)
    t = np.linspace(0, 1, len(x))
    env = np.sin(np.pi * t ** (1.6 if up else 0.6)) ** 2
    return x * env * 0.9


def riser(sec):
    n = sweep_filter(noise(sec), "bandpass", 200, 12000, curve=2.2)
    t = tvec(sec)
    f = mtof(41) * 2 ** (4 * (t / sec) ** 2)
    tone = sum(saw(f * d, sec) for d in (1, 1.007, 0.993)) / 3
    tone = sweep_filter(tone, "lowpass", 400, 9000, curve=2)
    env = (t / sec) ** 2
    return (n * 0.7 + tone * 0.35) * env


def reverse_cymbal(sec=1.0):
    return crash()[: int(sec * SR)][::-1] * 1.2


def blip(freq, sec=0.06):
    t = tvec(sec)
    return np.sign(np.sin(2 * np.pi * freq * t)) * np.exp(-t * 60) * 0.25


def bell(m, sec=1.6):
    """FM bell/sparkle."""
    t = tvec(sec)
    f = mtof(m)
    mod = np.sin(2 * np.pi * f * 3.5 * t) * 2.2 * np.exp(-t * 4)
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 3.2) * 0.4


def shatter():
    t = tvec(1.4)
    x = filt(noise(1.4), "highpass", 3000) * np.exp(-t * 5)
    for k in range(18):
        off = rng.uniform(0, 0.6)
        f = rng.uniform(2500, 9000)
        s = int(off * SR)
        tt = t[: len(t) - s]
        x[s:] += np.sin(2 * np.pi * f * tt) * np.exp(-tt * 25) * 0.15
    return x * 0.7


# ---------------------------------------------------------------- tonal
CHORDS = [  # F minor: i  VI  III  VII
    [53, 56, 60, 63, 65],  # Fm7
    [49, 53, 56, 60, 61],  # Dbmaj7
    [48, 51, 56, 60, 63],  # Ab/C
    [51, 55, 58, 62, 63],  # Eb(add9)
]
ROOTS = [29, 25, 32, 27]


def supersaw(m, sec, voices=7, spread=0.018):
    out = 0
    for v in range(voices):
        det = 1 + spread * (v - voices // 2) / (voices // 2)
        out = out + saw(mtof(m) * det, sec, phase=rng.random())
    return out / voices


def chord_stab(ci, sec, bright=6000, oct_=0):
    x = sum(supersaw(m + 12 * oct_, sec) for m in CHORDS[ci])
    x = filt(x, "lowpass", bright)
    return x * adsr(len(x), 0.004, 0.15, 0.35, 0.08) * 0.35


def pad(ci, sec, cutoff=1500):
    x = sum(supersaw(m, sec, spread=0.01) for m in CHORDS[ci])
    x = filt(x, "lowpass", cutoff)
    return x * adsr(len(x), 0.6, 0.2, 0.8, 0.5) * 0.25


def sub(m, sec):
    t = tvec(sec)
    x = np.sin(2 * np.pi * mtof(m) * t)
    return x * adsr(len(x), 0.003, 0.05, 0.9, 0.03)


def growl(m, sec, rate_beats=0.5):
    """Mid bass with a beat-synced filter wobble."""
    t = tvec(sec)
    f = mtof(m + 12)
    x = (saw(f, sec) + saw(f * 1.01, sec) + 0.5 * np.sign(np.sin(2 * np.pi * f / 2 * t))) / 2.5
    lfo = 0.5 - 0.5 * np.cos(2 * np.pi * t / (rate_beats * B))
    out = np.zeros_like(x)
    zi = np.zeros((1, 2))
    blk = 128
    for i in range(0, len(x), blk):
        fc = 180 + 2600 * lfo[i] ** 1.5
        s = sos("lowpass", fc, 2)
        out[i:i + blk], zi = signal.sosfilt(s, x[i:i + blk], zi=zi)
    return np.tanh(out * 2.5) * adsr(len(x), 0.004, 0.05, 0.9, 0.02) * 0.45


def pluck(m, sec=0.2, bright=7000):
    x = supersaw(m, sec, voices=3, spread=0.01)
    x = sweep_filter(x, "lowpass", bright, 500, curve=0.5, block=128)
    t = tvec(sec)
    return x * np.exp(-t * 14) * 0.5


# ---------------------------------------------------------------- arrangement
kicks = []  # beats where the sidechain ducks


def K(beat, big=False, g=1.0):
    add(L, at(beat), kick(big), g * (1.25 if big else 1.0))
    kicks.append(beat)


# INTRO 0-8: pad, riser, glitch blips, typing, reverse into hit
add(L, 0, pad(0, 4 * B + 0.3, 900), 0.9, rev=0.5)
add(L, at(4), pad(1, 4 * B, 1400), 0.9, rev=0.5)
add(L, 0, riser(8 * B) * 0.35, 1.0)
for b, f in ((2, 1800), (2.25, 2400), (4, 1500), (6, 2100), (6.5, 2900)):
    add(L, at(b), blip(f), 0.8, pan=rng.uniform(-0.7, 0.7), rev=0.3)
for i, ch in enumerate("PRESS START"):
    if ch != " ":
        add(L, at(4 + i * 0.25), blip(4200 + 300 * (i % 3), 0.02), 0.5, pan=(i - 5) / 8)
add(L, at(7), reverse_cymbal(B), 0.9)
add(L, at(7.25), whoosh(0.9 * B * 0.75 + 0.1), 0.8)

# SHAPES 8-16: four hits, each a new note, 8th hats, collapse whoosh
shape_notes = [77, 80, 84, 87]  # F5 Ab5 C6 Eb6
for i, b in enumerate((8, 10, 12, 14)):
    K(b, big=True)
    add(L, at(b), impact() * 0.55, 1.0, rev=0.35)
    add(L, at(b), chord_stab(i // 2 + (0 if i < 2 else 0), 2 * B, 5000), 0.9, rev=0.4)
    add(L, at(b), bell(shape_notes[i]), 0.9, pan=[-0.5, 0.5, -0.3, 0.3][i], rev=0.6)
    add(L, at(b + 1), clap() * 0.5, 1, rev=0.3)
for s in range(16):
    b = 8 + s * 0.5
    if s % 2:
        add(L, at(b), hat(), 0.6, pan=0.3)
for b in np.arange(8, 16, 1):
    add(L, at(b), sub(ROOTS[int((b - 8) // 4)], B * 0.9), 0.5)
add(L, at(15), whoosh(B, up=False), 0.9)
add(L, at(15.5), reverse_cymbal(B / 2), 0.7)

# BUILD 16-24: word stabs, accelerating snare, riser, drop-out at 23
words = [16, 17, 18, 19, 20, 21]
for i, b in enumerate(words):
    K(b)
    add(L, at(b), chord_stab((i // 2) % 4, B * 0.8, 3000 + i * 900), 1.2, rev=0.3)
roll = []
b = 16.0
while b < 23:
    roll.append(b)
    step = 1 if b < 18 else 0.5 if b < 20 else 0.25 if b < 22 else 0.125
    b += step
for i, b in enumerate(roll):
    add(L, at(b), snare(), 0.25 + 0.6 * (b - 16) / 7, pan=0.1, rev=0.2)
add(L, at(16), riser(7 * B), 1.0)
for b in np.arange(16, 23, 0.5):
    add(L, at(b), sub(ROOTS[0] + 12 * ((b - 16) / 7 > 0.6), B * 0.45), 0.35)
# 23-24: silence but a reverse cymbal + "ready" blips
add(L, at(23), reverse_cymbal(B), 0.7, rev=0.2)
add(L, at(23), blip(880, 0.08), 0.6)
add(L, at(23.5), blip(1320, 0.08), 0.6)


def drop(start_bar, bars, lead_oct=0, stutter_last=False):
    for bar in range(start_bar, start_bar + bars):
        ci = bar % 4
        b0 = bar * 4
        add(L, at(b0), crash() * 0.5, 1, pan=0.2, rev=0.3)
        for q in range(4):
            K(b0 + q)
            if q in (1, 3):
                add(L, at(b0 + q), clap(), 0.8, rev=0.35)
            add(L, at(b0 + q + 0.5), hat(True), 0.5, pan=-0.2)
            for s in range(4):
                add(L, at(b0 + q + s * 0.25), hat(), 0.25 + 0.15 * (s == 2), pan=0.35)
        # sidechained chords on off-beats (classic pumping)
        add(L, at(b0), chord_stab(ci, 4 * B, 7000, 0) * 1.0, 0.85, rev=0.25)
        # sub + growl
        add(L, at(b0), sub(ROOTS[ci], 4 * B), 0.9)
        add(L, at(b0), growl(ROOTS[ci], 4 * B, rate_beats=0.5 if bar % 2 == 0 else 0.25), 0.7)
        # arp lead, 16ths
        arp = CHORDS[ci][1:] + [CHORDS[ci][2] + 12]
        for s in range(16):
            m = arp[(s * 3 + bar) % len(arp)] + 12 + 12 * lead_oct
            pan = 0.45 * np.sin(s * 0.9)
            add(L, at(b0 + s * 0.25), pluck(m, 0.18), 0.55, pan=pan, rev=0.35)


# DROP 1 24-40
add(L, at(24), impact(), 1.1, rev=0.4)
drop(6, 4)
for b in (28, 32, 36):
    add(L, at(b - 0.5), whoosh(0.5 * B + 0.05), 0.55)

# BREAKDOWN 40-48: shatter, pads, heartbeat, riser
add(L, at(40), shatter(), 1.0, rev=0.6)
add(L, at(40), impact() * 0.55, 1.0, rev=0.5)
add(L, at(40), pad(0, 4 * B + 0.4, 700), 0.6, rev=0.6)
add(L, at(44), pad(1, 4 * B, 1100), 0.6, rev=0.6)
for b in (42, 44, 46):
    add(L, at(b), kick() * 0.6, 1.0, rev=0.3)
for s in range(8 * 2):
    b = 40 + s * 0.5
    m = [72, 75, 77, 80, 84, 80, 77, 75][s % 8]
    add(L, at(b), bell(m, 0.9) * 0.4, 1, pan=0.6 * np.sin(s), rev=0.7)
b = 46.0
while b < 48:
    add(L, at(b), snare(), 0.3 + 0.5 * (b - 46) / 2, rev=0.2)
    b += 0.25 if b < 47 else 0.125
add(L, at(44), riser(4 * B), 0.75)
add(L, at(47.5), reverse_cymbal(B / 2), 0.9)

# DROP 2 48-60 (lead up an octave), whooshes on every wipe in 56-60
add(L, at(48), impact(), 1.2, rev=0.4)
drop(12, 3, lead_oct=1)
for b in range(56, 60):
    add(L, at(b - 0.2), whoosh(0.25, up=True), 0.5, pan=0.8 * (1 if b % 2 else -1))
for b in (52,):
    add(L, at(b - 0.5), whoosh(0.5 * B + 0.05), 0.55)

# OUTRO 60-64: final hit, logo bells, big chord in reverb
add(L, at(60), impact(), 1.0, rev=0.4)
K(60, big=True)
add(L, at(60), crash(), 0.7, rev=0.4)
add(L, at(60), pad(0, 4 * B + 0.5, 3000), 0.8, rev=0.6)
add(L, at(60), sub(29, 3.0), 0.8)
for i, b in enumerate((60.5, 61, 61.5, 62)):
    add(L, at(b), bell(shape_notes[i] + 12, 1.4), 0.8, pan=[-0.6, -0.2, 0.2, 0.6][i], rev=0.8)
add(L, at(62.5), whoosh(0.9, up=True) * 0.4, 1.0, rev=0.5)

# ---------------------------------------------------------------- bus fx
mix = np.vstack([L, R])

# sidechain pump on everything except drums would be ideal; approximating by
# pumping the whole bus lightly + the tonal content was written dry
t = np.arange(N) / SR
duck = np.ones(N)
for k in kicks:
    s = at(k)
    tt = t[s:] - t[s]
    duck[s:] *= 1 - 0.45 * np.exp(-tt / 0.07) * (tt < 0.4)

# reverb: stereo decaying noise IR
ir_len = int(2.4 * SR)
irt = np.arange(ir_len) / SR
ir = np.vstack([filt(rng.standard_normal(ir_len), "lowpass", 6000) * np.exp(-irt * 2.6) for _ in range(2)]) * 0.06
wet = np.vstack([signal.fftconvolve(send[c], ir[c])[:N] for c in range(2)])
mix = mix * duck + wet * 0.9

# stutter/glitch edits (repeat a slice), matched to visual glitches
def stutter(beat, length_beats, slice_beats):
    s0 = at(beat)
    sl = at(beat + slice_beats) - s0
    e = at(beat + length_beats)
    seg = mix[:, s0:s0 + sl].copy()
    fade = np.ones(sl)
    fade[-200:] = np.linspace(1, 0, 200)
    for p in range(s0, e, sl):
        n = min(sl, e - p)
        mix[:, p:p + n] = seg[:, :n] * fade[:n]


stutter(39, 1, 0.25)
stutter(39.5, 0.5, 0.125)
stutter(59, 0.5, 0.125)


def tape_stop(beat, length_beats):
    s0, e = at(beat), at(beat + length_beats)
    n = e - s0
    rate = np.linspace(1, 0.05, n) ** 1.5
    pos = s0 + np.cumsum(rate)
    for c in range(2):
        mix[c, s0:e] = np.interp(pos, np.arange(N), mix[c]) * np.linspace(1, 0.2, n)


tape_stop(59.5, 0.5)

# intro fade in, tail fade out
fi = int(0.25 * SR)
mix[:, :fi] *= np.linspace(0, 1, fi)
fo = int(1.0 * SR)
mix[:, -fo:] *= np.linspace(1, 0, fo) ** 2

# master: highpass rumble, glue, limit
mix = np.vstack([filt(mix[c], "highpass", 28) for c in range(2)])
# bus compressor: 4:1 above -18 dB, fast attack, 120ms release
lvl = np.max(np.abs(mix), axis=0)
env = signal.lfilter([1 - np.exp(-1 / (0.12 * SR))], [1, -np.exp(-1 / (0.12 * SR))], lvl)
env = np.maximum(env, signal.lfilter([1 - np.exp(-1 / (0.004 * SR))], [1, -np.exp(-1 / (0.004 * SR))], lvl))
peak = np.max(env)
thr = peak * 10 ** (-15 / 20)
gr = np.where(env > thr, (thr * (env / thr) ** 0.34) / np.maximum(env, 1e-9), 1.0)
mix = mix * gr
mix = mix / np.percentile(np.abs(mix), 99.9) * 1.1
mix = np.tanh(mix) / np.tanh(1.3)
mix *= 0.93
# breakdown sits back so drop 2 hits harder
auto = np.ones(N)
auto[at(40.25):at(46)] = 0.55
auto[at(40):at(40.25)] = np.linspace(1, 0.55, at(40.25) - at(40))
auto[at(46):at(48)] = np.linspace(0.55, 1, at(48) - at(46))
mix *= auto
wavfile.write("nova.wav", SR, (mix.T * 32767).astype(np.int16))
print("ok", mix.shape, float(np.sqrt(np.mean(mix ** 2))))
