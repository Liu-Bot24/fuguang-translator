from __future__ import annotations

import signal
import sys
from contextlib import contextmanager

import numpy as np
import soundcard as sc

from float_translator.config import ConfigManager
from float_translator.translation import DashScopeRealtimeBackend

SAMPLE_RATE = 16000
BLOCK_SIZE = 2048
CHANNELS = 1


def float_to_pcm16(data: np.ndarray) -> bytes:
    clipped = np.clip(data, -1.0, 1.0)
    int_data = (clipped * np.iinfo(np.int16).max).astype(np.int16)
    return int_data.tobytes()


@contextmanager
def graceful_exit(handler):
    previous = signal.getsignal(signal.SIGINT)
    signal.signal(signal.SIGINT, handler)
    try:
        yield
    finally:
        signal.signal(signal.SIGINT, previous)


def main() -> None:
    config = ConfigManager().load()
    dashscope = config.dashscope
    if not dashscope.api_key:
        print("请先在 config.ini 中填写 dashscope.api_key")
        return

    backend = DashScopeRealtimeBackend(dashscope, SAMPLE_RATE)
    backend.start()

    microphone = sc.default_microphone()
    if microphone is None:
        raise RuntimeError("未找到默认麦克风设备")

    print("开始录音，按 Ctrl+C 停止...")
    running = True

    def _stop(_signum, _frame):
        nonlocal running
        running = False

    with graceful_exit(_stop):
        with microphone.recorder(
            samplerate=SAMPLE_RATE,
            channels=CHANNELS,
            blocksize=BLOCK_SIZE,
        ) as recorder:
            while running:
                frames = recorder.record(BLOCK_SIZE)
                if frames is None:
                    continue
                backend.send_audio(float_to_pcm16(frames))
                for text in backend.poll_translations():
                    if text:
                        print("译文:", text)
    backend.flush()
    backend.stop()
    print("已停止。")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(0)
