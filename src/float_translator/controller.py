from __future__ import annotations

from typing import Optional

from PyQt6 import QtCore

from .audio import AudioCaptureConfig
from .config import DashScopeConfig
from .translation import TranslationWorker


class TranslationController(QtCore.QObject):
    subtitle_ready = QtCore.pyqtSignal(str)
    error_occurred = QtCore.pyqtSignal(str)
    state_changed = QtCore.pyqtSignal(bool)

    def __init__(
        self,
        dashscope_config: DashScopeConfig,
        audio_config: AudioCaptureConfig | None = None,
        parent: Optional[QtCore.QObject] = None,
    ) -> None:
        super().__init__(parent)
        self._config = dashscope_config
        self._audio_config = audio_config
        self._worker: Optional[TranslationWorker] = None

    def start(self) -> None:
        if self._worker and self._worker.isRunning():
            return
        self._worker = TranslationWorker(self._config, self._audio_config, parent=self)
        self._worker.subtitle_ready.connect(self.subtitle_ready.emit)
        self._worker.error_occurred.connect(self.error_occurred.emit)
        self._worker.finished.connect(self._handle_worker_finished)
        self._worker.start()
        self.state_changed.emit(True)

    def stop(self) -> None:
        if not self._worker:
            return
        self._worker.stop()
        self._worker.wait(5000)
        self._worker = None
        self.state_changed.emit(False)

    def update_dashscope_config(self, config: DashScopeConfig) -> None:
        restart = self.is_running()
        if restart:
            self.stop()
        self._config = config
        if restart:
            self.start()

    def _handle_worker_finished(self) -> None:
        self._worker = None
        self.state_changed.emit(False)

    def is_running(self) -> bool:
        return bool(self._worker and self._worker.isRunning())
