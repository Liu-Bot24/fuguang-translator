from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

from PyQt6 import QtCore, QtGui, QtWidgets

from .config import AppConfig, ConfigManager
from .controller import TranslationController
from .widgets import SettingsDialog, SubtitleMainWindow

APP_ICON_PATH = Path(__file__).resolve().parent.parent.parent / "translate.svg"


@dataclass
class TranslatorHooks:
    start: Callable[[], None]
    stop: Callable[[], None]


class ApplicationController(QtCore.QObject):
    """Coordinates UI widgets and the translation backend."""

    open_settings_requested = QtCore.pyqtSignal()
    streaming_state_changed = QtCore.pyqtSignal(bool)

    def __init__(self, window_icon: QtGui.QIcon | None = None) -> None:
        super().__init__()
        self._window = SubtitleMainWindow(window_icon)
        if window_icon is not None:
            self._window.setWindowIcon(window_icon)
        self._window.start_requested.connect(self._handle_start)
        self._window.pause_requested.connect(self._handle_pause)
        self._window.settings_requested.connect(self.open_settings_requested.emit)
        self._window.exit_requested.connect(self.quit)
        self._window.history_cleared.connect(self._reset_transcript_cache)
        self._window.transcript_modified.connect(self._handle_transcript_modified)

        self._translator_hooks: Optional[TranslatorHooks] = None
        self._is_streaming = False
        self._transcript_text: str = ""

    # ---- Public API --------------------------------------------------

    def start(self) -> None:
        self._window.show()

    def attach_translator(self, hooks: TranslatorHooks) -> None:
        self._translator_hooks = hooks
        self._window.set_streaming_state(self._is_streaming)

    def add_history_entry(self, text: str) -> None:
        normalized = text.strip()
        if not normalized:
            return

        if not self._transcript_text:
            self._transcript_text = normalized
            self._window.set_transcript(self._transcript_text)
            return

        if normalized == self._transcript_text:
            return

        if normalized.startswith(self._transcript_text):
            addition = normalized[len(self._transcript_text) :]
            if addition:
                self._transcript_text = normalized
                self._window.append_transcript(addition)
            return

        if self._transcript_text.endswith(normalized):
            return


        overlap = self._longest_overlap(self._transcript_text, normalized)
        if overlap > 0:
            addition = normalized[overlap:]
            if addition:
                self._transcript_text += addition
                self._window.append_transcript(addition)
            return

        separator = "" if self._transcript_text.endswith("\n") or not self._transcript_text else "\n"
        addition = separator + normalized
        self._transcript_text += addition
        self._window.append_transcript(addition)

    def apply_display_config(self, config: AppConfig) -> None:
        display = config.display
        self._window.apply_display_config(
            font_family=display.font_family,
            font_size=display.font_size,
            font_color=display.font_color,
            opacity=display.background_opacity,
        )

    def is_streaming(self) -> bool:
        return self._is_streaming

    # ---- Control handlers -------------------------------------------

    def _handle_start(self) -> None:
        if not self._translator_hooks or self._is_streaming:
            return
        self._translator_hooks.start()
        self._is_streaming = True
        self._window.set_streaming_state(True)
        self.streaming_state_changed.emit(True)

    def _handle_pause(self) -> None:
        if not self._translator_hooks or not self._is_streaming:
            return
        self._translator_hooks.stop()
        self._is_streaming = False
        self._window.set_streaming_state(False)
        self.streaming_state_changed.emit(False)

    def _reset_transcript_cache(self) -> None:
        self._transcript_text = ""

    def quit(self) -> None:
        QtWidgets.QApplication.instance().quit()

    def _handle_transcript_modified(self, text: str) -> None:
        self._transcript_text = text

    @staticmethod
    def _longest_overlap(previous: str, current: str) -> int:
        max_len = min(len(previous), len(current))
        for size in range(max_len, 0, -1):
            if current.startswith(previous[-size:]):
                return size
        return 0


class SubtitleApplication(QtWidgets.QApplication):
    def __init__(self, argv: list[str]) -> None:
        super().__init__(argv)
        self.setApplicationName("浮光译影")
        self.setQuitOnLastWindowClosed(True)

        self._config_manager = ConfigManager()
        self._config = self._config_manager.load()

        icon = self._load_app_icon()
        if icon is not None:
            self.setWindowIcon(icon)

        self._controller = ApplicationController(icon)
        self._controller.apply_display_config(self._config)
        self._controller.open_settings_requested.connect(self._open_settings_dialog)

        self._translation_controller = TranslationController(
            self._config.dashscope,
            parent=self,
        )
        self._translation_controller.subtitle_ready.connect(self._handle_subtitle_ready)
        self._translation_controller.error_occurred.connect(self._handle_error)

        self._controller.attach_translator(
            TranslatorHooks(
                start=self._translation_controller.start,
                stop=self._translation_controller.stop,
            )
        )
        self._controller.start()

    @property
    def controller(self) -> ApplicationController:
        return self._controller

    def _load_app_icon(self) -> QtGui.QIcon | None:
        if APP_ICON_PATH.exists():
            return QtGui.QIcon(str(APP_ICON_PATH))
        return None

    def _handle_subtitle_ready(self, text: str) -> None:
        self._controller.add_history_entry(text)

    def _handle_error(self, message: str) -> None:
        QtWidgets.QMessageBox.critical(None, "翻译服务错误", message)

    def _open_settings_dialog(self) -> None:
        dialog = SettingsDialog(self._config, parent=self._controller._window)
        if dialog.exec() == QtWidgets.QDialog.DialogCode.Accepted:
            self._config = dialog.result_config()
            self._config_manager.save(self._config)
            self._controller.apply_display_config(self._config)
            self._translation_controller.update_dashscope_config(self._config.dashscope)


def run() -> None:
    app = SubtitleApplication(sys.argv)
    sys.exit(app.exec())


if __name__ == "__main__":
    run()
