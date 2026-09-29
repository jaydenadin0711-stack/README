import sys, numpy as np, sherpa_onnx
from scipy.io import wavfile
K = 'tts/kokoro/'
tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
    kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(model=K + 'model.int8.onnx', voices=K + 'voices.bin', tokens=K + 'tokens.txt', data_dir=K + 'espeak-ng-data'),
    num_threads=4)))
LINES = ["Some watches tell the time.", "This one tells two.",
         "Born in the cockpit, for pilots crossing the world overnight.", "Two time zones. One glance.",
         "Oystersteel. Five-piece Jubilee links.", "Sealed by the Oysterclasp.",
         "When the lights go down, it keeps shining.", "Wherever you land, you're already on time.",
         "GMT-Master Two. Rolex."]
STARTS = [0.6, 3.4, 6.35, 9.8, 12.8, 15.8, 18.8, 21.9, 26.35, 30]
sid, speed = int(sys.argv[1]), float(sys.argv[2])
for i, ln in enumerate(LINES):
    a = tts.generate(ln, sid=sid, speed=speed)
    x = np.array(a.samples)
    nz = np.flatnonzero(np.abs(x) > 0.01); x = x[max(0, nz[0] - 200):nz[-1] + 2400]
    wavfile.write(f'vo/{sid}_{i}.wav', a.sample_rate, (x * 32767).astype(np.int16))
    room = STARTS[i + 1] - STARTS[i] - 0.15
    print(i, f'{len(x) / a.sample_rate:.2f}s / {room:.2f}s', 'OVER' if len(x) / a.sample_rate > room else '')
