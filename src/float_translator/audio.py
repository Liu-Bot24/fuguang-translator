from __future__ import annotations

from dataclasses import dataclass
from typing import Generator

import numpy as np
import soundcard as sc


@dataclass
class AudioCaptureConfig:
    samplerate: int = 16000
    block_size: int = 2048
    channels: int = 1


class SystemAudioCapture:
    """Captures loopback audio from the system speaker using soundcard."""

    def __init__(self, config: AudioCaptureConfig | None = None) -> None:
        self.config = config or AudioCaptureConfig()
        self._microphone = self._resolve_loopback_microphone()

    def _resolve_loopback_microphone(self) -> sc.Microphone:
        speaker = sc.default_speaker()
        candidates = []
        for mic in sc.all_microphones(include_loopback=True):
            if getattr(mic, "isloopback", False):
                candidates.append(mic)
        if speaker is not None:
            for mic in candidates:
                if mic.name == speaker.name:
                    return mic
        if candidates:
            return candidates[0]
        raise RuntimeError("无法找到系统扬声器的回环输入，请检查声卡设置。")

    def stream_pcm_chunks(self) -> Generator[bytes, None, None]:
        """Yields 16-bit PCM-encoded audio bytes."""
        with self._microphone.recorder(
            samplerate=self.config.samplerate,
            channels=self.config.channels,
            blocksize=self.config.block_size,
        ) as recorder:
            while True:
                frames = recorder.record(self.config.block_size)
                if frames is None:
                    continue
                yield self._float_to_pcm16(frames)

    def _float_to_pcm16(self, data: np.ndarray) -> bytes:
        clipped = np.clip(data, -1.0, 1.0)
        int_data = (clipped * np.iinfo(np.int16).max).astype(np.int16)
        return int_data.tobytes()
