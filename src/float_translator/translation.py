from __future__ import annotations

import base64
import json
import threading
import time
from typing import Iterable, Optional, Protocol

from PyQt6 import QtCore

from .audio import AudioCaptureConfig, SystemAudioCapture
from .config import DashScopeConfig

try:  # noqa: SIM105 - optional dependency guard
    import websocket
except ImportError as exc:  # pragma: no cover - dependency check
    websocket = None  # type: ignore[assignment]
    _ws_import_error = exc
else:
    _ws_import_error = None


BASE_WS_ENDPOINT = "wss://dashscope.aliyuncs.com/api-ws/v1/realtime"


class TranslationBackend(Protocol):
    """Minimal interface for a streaming translation backend."""

    def start(self) -> None: ...

    def send_audio(self, pcm_chunk: bytes) -> None: ...

    def poll_translations(self) -> Iterable[str]: ...

    def flush(self) -> None: ...

    def stop(self) -> None: ...


class DashScopeRealtimeBackend:
    """Streaming client for DashScope realtime translation service."""

    def __init__(self, config: DashScopeConfig, samplerate: int) -> None:
        if _ws_import_error is not None:
            raise RuntimeError(
                "缺少 websocket-client 依赖，请运行 pip install websocket-client"
            ) from _ws_import_error

        self.config = config
        self._samplerate = samplerate
        self._ws: Optional[websocket.WebSocket] = None
        self._lock = threading.Lock()
        self._event_counter = 0

    # ---- Lifecycle -----------------------------------------------------

    def start(self) -> None:
        if not self.config.api_key:
            raise RuntimeError("未配置 DashScope API Key，请在 config.ini 中填写 dashscope.api_key")
        url = f"{BASE_WS_ENDPOINT}?model={self.config.model}"
        headers = [f"Authorization: Bearer {self.config.api_key}"]
        self._ws = websocket.create_connection(url, header=headers, enable_multithread=True)
        self._ws.settimeout(0.1)
        self._send_session_update()

    def _send_session_update(self) -> None:
        session = {
            "modalities": ["text"],
            "input_audio_format": "pcm16",
            "translation": {"language": self.config.target_language},
        }
        payload = {
            "event_id": self._next_event_id(),
            "type": "session.update",
            "session": session,
        }
        self._send_json(payload)

    # ---- Audio streaming ----------------------------------------------

    def send_audio(self, pcm_chunk: bytes) -> None:
        if not self._ws or not pcm_chunk:
            return
        audio_event = {
            "event_id": self._next_event_id(),
            "type": "input_audio_buffer.append",
            "audio": base64.b64encode(pcm_chunk).decode("ascii"),
        }
        self._send_json(audio_event)

    def flush(self) -> None:
        # 当前 DashScope 实时接口会自动进行语音段落检测，无需手动提交。
        return

    # ---- Networking helpers -------------------------------------------

    def _send_json(self, message: dict) -> None:
        if not self._ws:
            raise RuntimeError("WebSocket 尚未建立")
        with self._lock:
            self._ws.send(json.dumps(message))

    def poll_translations(self) -> Iterable[str]:
        transcripts: list[str] = []
        if not self._ws:
            return transcripts
        while True:
            try:
                payload = self._ws.recv()
            except websocket.WebSocketTimeoutException:
                break
            except websocket.WebSocketConnectionClosedException as exc:
                raise RuntimeError("DashScope WebSocket 已关闭") from exc
            data = json.loads(payload)
            event_type = data.get("type")
            if event_type in {"response.audio_transcript.delta", "response.audio_transcript.done"}:
                text = data.get("transcript")
                if text:
                    transcripts.append(text)
            elif event_type and "response.text" in event_type:
                text = data.get("text") or data.get("stash")
                if not text and isinstance(data.get("part"), dict):
                    text = data["part"].get("text")
                if text:
                    transcripts.append(text)
            elif event_type == "response.content_part.added":
                part = data.get("part") or {}
                if part.get("type") == "text":
                    text = part.get("text")
                    if text:
                        transcripts.append(text)
            elif event_type == "error":
                details = data.get("message")
                if not details and isinstance(data.get("error"), dict):
                    details = data["error"].get("message")
                if not details:
                    details = json.dumps(data, ensure_ascii=False)
                raise RuntimeError(f"DashScope 服务返回错误: {details}")
        return transcripts

    def stop(self) -> None:
        if self._ws:
            try:
                self._ws.close()
            finally:
                self._ws = None

    # ---- Utility ------------------------------------------------------

    def _next_event_id(self) -> str:
        self._event_counter += 1
        return f"event_{int(time.time() * 1000)}_{self._event_counter}"


class MockTranslatorBackend:
    """Fallback backend used when the DashScope credentials are not configured."""

    def __init__(self, samplerate: int) -> None:
        self._buffer = 0
        self._samplerate = samplerate

    def start(self) -> None:
        self._buffer = 0

    def send_audio(self, pcm_chunk: bytes) -> None:
        self._buffer += len(pcm_chunk)

    def poll_translations(self) -> Iterable[str]:
        if self._buffer == 0:
            return []
        seconds = self._buffer / (self._samplerate * 2)
        self._buffer = 0
        return [f"[Mock] 已处理约 {seconds:.1f} 秒音频"]

    def flush(self) -> None:
        self._buffer = 0

    def stop(self) -> None:
        self._buffer = 0


class TranslationWorker(QtCore.QThread):
    """Background worker that captures audio and pushes it to the translation backend."""

    subtitle_ready = QtCore.pyqtSignal(str)
    error_occurred = QtCore.pyqtSignal(str)

    def __init__(
        self,
        config: DashScopeConfig,
        audio_config: AudioCaptureConfig | None = None,
        parent: Optional[QtCore.QObject] = None,
    ) -> None:
        super().__init__(parent)
        self._audio_config = audio_config or AudioCaptureConfig()
        self._audio_capture = SystemAudioCapture(self._audio_config)
        self._config = config
        self._stop_event = threading.Event()
        self._backend: Optional[TranslationBackend] = None
        self._last_caption: str = ""

    def stop(self) -> None:
        self._stop_event.set()

    def run(self) -> None:  # type: ignore[override]
        try:
            backend = self._create_backend()
            self._backend = backend
            backend.start()
            self._last_caption = ""
            for chunk in self._audio_capture.stream_pcm_chunks():
                if self._stop_event.is_set():
                    break
                backend.send_audio(chunk)
                for caption in backend.poll_translations():
                    normalized = (caption or "").strip()
                    if not normalized or normalized == self._last_caption:
                        continue
                    self._last_caption = normalized
                    self.subtitle_ready.emit(normalized)
            backend.flush()
            backend.stop()
        except Exception as exc:  # pragma: no cover - runtime error path
            self.error_occurred.emit(str(exc))
        finally:
            self._backend = None
            self._last_caption = ""

    def _create_backend(self) -> TranslationBackend:
        if self._config.api_key:
            return DashScopeRealtimeBackend(self._config, self._audio_config.samplerate)
        return MockTranslatorBackend(self._audio_config.samplerate)
