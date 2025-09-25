from __future__ import annotations

from datetime import datetime
from pathlib import Path

from PyQt6 import QtCore, QtGui, QtWidgets
from PyQt6.QtCore import QUrl


WINDOW_STYLE = "QWidget {background-color: #131313; color: #F2F2F2;}"
PRIMARY_STYLE = (
    "QPushButton {"
    "  background-color: #2F80ED;"
    "  color: #FFFFFF;"
    "  border: none;"
    "  border-radius: 6px;"
    "  padding: 10px 26px;"
    "  font-size: 17px;"
    "  font-weight: 600;"
    "}"
    "QPushButton:hover {"
    "  background-color: #4D92F1;"
    "}"
    "QPushButton:pressed {"
    "  background-color: #1F5FCC;"
    "}"
)
PAUSE_STYLE = (
    "QPushButton {"
    "  background-color: #D35400;"
    "  color: #FFFFFF;"
    "  border: none;"
    "  border-radius: 6px;"
    "  padding: 10px 26px;"
    "  font-size: 17px;"
    "  font-weight: 600;"
    "}"
    "QPushButton:hover {"
    "  background-color: #E16A17;"
    "}"
    "QPushButton:pressed {"
    "  background-color: #B14500;"
    "}"
)
SECONDARY_STYLE = (
    "QPushButton {"
    "  background-color: #212121;"
    "  color: #EEEEEE;"
    "  border: 1px solid #3B3B3B;"
    "  border-radius: 6px;"
    "  padding: 8px 20px;"
    "  font-size: 15px;"
    "}"
    "QPushButton:hover {"
    "  background-color: #2B2B2B;"
    "}"
    "QPushButton:pressed {"
    "  background-color: #191919;"
    "}"
)
STATUS_IDLE_STYLE = "QLabel {color: #9E9E9E; font-size: 14px;}"
STATUS_ACTIVE_STYLE = "QLabel {color: #2ECC71; font-size: 14px;}"
TRANSCRIPT_STYLE_TEMPLATE = (
    "font-size: {font_size}px;"
    "font-family: '{font_family}';"
    "color: {font_color};"
    "line-height: 1.55;"
    "background-color: #1B1B1B;"
    "border: 1px solid #2E2E2E;"
    "border-radius: 14px;"
    "padding: 20px;"
)
SAVE_DIR_NAME = "浮光译影字幕"


class _SaveTaskSignals(QtCore.QObject):
    success = QtCore.pyqtSignal(str)
    failure = QtCore.pyqtSignal(str)


class _SaveTranscriptTask(QtCore.QRunnable):
    def __init__(self, target_path: Path, content: str) -> None:
        super().__init__()
        self._path = target_path
        self._content = content
        self.signals = _SaveTaskSignals()

    def run(self) -> None:  # type: ignore[override]
        try:
            self._path.parent.mkdir(parents=True, exist_ok=True)
            self._path.write_text(self._content, encoding="utf-8")
        except Exception as exc:  # pragma: no cover - filesystem errors
            self.signals.failure.emit(str(exc))
        else:
            self.signals.success.emit(str(self._path))


class SavedTranscriptsDialog(QtWidgets.QDialog):
    def __init__(
        self,
        directory: Path,
        parent: QtWidgets.QWidget | None = None,
        icon: QtGui.QIcon | None = None,
    ) -> None:
        super().__init__(parent)
        self._directory = directory
        self.setWindowTitle("已保存字幕")
        if icon is not None:
            self.setWindowIcon(icon)
        self.resize(640, 420)

        layout = QtWidgets.QVBoxLayout(self)

        top_bar = QtWidgets.QHBoxLayout()
        self._refresh_btn = QtWidgets.QPushButton("刷新", self)
        self._open_dir_btn = QtWidgets.QPushButton("打开文件夹", self)
        top_bar.addWidget(self._refresh_btn)
        top_bar.addWidget(self._open_dir_btn)
        top_bar.addStretch(1)
        layout.addLayout(top_bar)

        splitter = QtWidgets.QSplitter(QtCore.Qt.Orientation.Horizontal, self)
        self._list = QtWidgets.QListWidget(splitter)
        self._list.setMinimumWidth(240)
        self._preview = QtWidgets.QPlainTextEdit(splitter)
        self._preview.setReadOnly(True)
        splitter.setStretchFactor(0, 0)
        splitter.setStretchFactor(1, 1)
        layout.addWidget(splitter)

        self._refresh_btn.clicked.connect(self.refresh)
        self._open_dir_btn.clicked.connect(self._open_directory)
        self._list.itemSelectionChanged.connect(self._load_preview)
        self._list.itemDoubleClicked.connect(self._open_selected_file)

    def refresh(self) -> None:
        self._list.clear()
        self._preview.clear()
        if not self._directory.exists():
            try:
                self._directory.mkdir(parents=True, exist_ok=True)
            except Exception:
                pass
        files = sorted(
            self._directory.glob("*.md"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )
        if not files:
            placeholder = QtWidgets.QListWidgetItem("暂无保存的字幕")
            placeholder.setFlags(QtCore.Qt.ItemFlag.NoItemFlags)
            self._list.addItem(placeholder)
            return
        for path in files:
            ts = datetime.fromtimestamp(path.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")
            item = QtWidgets.QListWidgetItem(f"{path.name}  ({ts})")
            item.setData(QtCore.Qt.ItemDataRole.UserRole, str(path))
            self._list.addItem(item)
        self._list.setCurrentRow(0)

    def _load_preview(self) -> None:
        item = self._list.currentItem()
        if not item:
            return
        path = item.data(QtCore.Qt.ItemDataRole.UserRole)
        if not path:
            self._preview.clear()
            return
        try:
            content = Path(path).read_text(encoding="utf-8")
        except Exception as exc:
            self._preview.setPlainText(f"无法读取文件：{exc}")
        else:
            self._preview.setPlainText(content)

    def _open_directory(self) -> None:
        QtGui.QDesktopServices.openUrl(QUrl.fromLocalFile(str(self._directory)))

    def _open_selected_file(self, item: QtWidgets.QListWidgetItem) -> None:
        path = item.data(QtCore.Qt.ItemDataRole.UserRole)
        if path:
            QtGui.QDesktopServices.openUrl(QUrl.fromLocalFile(path))


class SubtitleMainWindow(QtWidgets.QMainWindow):
    start_requested = QtCore.pyqtSignal()
    pause_requested = QtCore.pyqtSignal()
    settings_requested = QtCore.pyqtSignal()
    exit_requested = QtCore.pyqtSignal()
    history_cleared = QtCore.pyqtSignal()
    transcript_modified = QtCore.pyqtSignal(str)

    def __init__(self, icon: QtGui.QIcon | None = None) -> None:
        super().__init__()
        self.setWindowTitle("浮光译影")
        if icon is not None:
            self.setWindowIcon(icon)
        self.resize(900, 640)
        self.setStyleSheet(WINDOW_STYLE)

        central = QtWidgets.QWidget(self)
        self.setCentralWidget(central)

        main_layout = QtWidgets.QVBoxLayout(central)
        main_layout.setContentsMargins(22, 22, 22, 22)
        main_layout.setSpacing(14)

        control_bar = QtWidgets.QHBoxLayout()
        control_bar.setSpacing(10)

        self._start_pause_button = QtWidgets.QPushButton("▶ 开始", self)
        self._start_pause_button.setCursor(QtCore.Qt.CursorShape.PointingHandCursor)
        self._start_pause_button.setStyleSheet(PRIMARY_STYLE)

        self._status_label = QtWidgets.QLabel("未开始", self)
        self._status_label.setStyleSheet(STATUS_IDLE_STYLE)

        control_bar.addWidget(self._start_pause_button)
        control_bar.addWidget(self._status_label)

        self._autoscroll_button = QtWidgets.QPushButton(self)
        self._autoscroll_button.setCheckable(True)
        self._autoscroll_button.setCursor(QtCore.Qt.CursorShape.PointingHandCursor)
        self._autoscroll_button.setStyleSheet(SECONDARY_STYLE)
        control_bar.addWidget(self._autoscroll_button)

        self._clear_button = QtWidgets.QPushButton("清空字幕", self)
        self._clear_button.setCursor(QtCore.Qt.CursorShape.PointingHandCursor)
        self._clear_button.setStyleSheet(SECONDARY_STYLE)
        control_bar.addWidget(self._clear_button)

        self._save_button = QtWidgets.QPushButton("保存为 .md", self)
        self._save_button.setCursor(QtCore.Qt.CursorShape.PointingHandCursor)
        self._save_button.setStyleSheet(SECONDARY_STYLE)
        control_bar.addWidget(self._save_button)

        self._saved_view_button = QtWidgets.QPushButton("查看保存", self)
        self._saved_view_button.setCursor(QtCore.Qt.CursorShape.PointingHandCursor)
        self._saved_view_button.setStyleSheet(SECONDARY_STYLE)
        control_bar.addWidget(self._saved_view_button)

        control_bar.addStretch(1)

        self._settings_button = QtWidgets.QPushButton("设置", self)
        self._settings_button.setCursor(QtCore.Qt.CursorShape.PointingHandCursor)
        self._settings_button.setStyleSheet(SECONDARY_STYLE)
        control_bar.addWidget(self._settings_button)

        self._exit_button = QtWidgets.QPushButton("退出", self)
        self._exit_button.setCursor(QtCore.Qt.CursorShape.PointingHandCursor)
        self._exit_button.setStyleSheet(SECONDARY_STYLE)
        control_bar.addWidget(self._exit_button)

        main_layout.addLayout(control_bar)

        self._transcript_edit = QtWidgets.QTextEdit(self)
        self._transcript_edit.setAcceptRichText(False)
        self._transcript_edit.setLineWrapMode(QtWidgets.QTextEdit.LineWrapMode.WidgetWidth)
        self._transcript_edit.setContextMenuPolicy(QtCore.Qt.ContextMenuPolicy.DefaultContextMenu)
        self._transcript_edit.setVerticalScrollBarPolicy(QtCore.Qt.ScrollBarPolicy.ScrollBarAlwaysOn)
        self._transcript_edit.setHorizontalScrollBarPolicy(QtCore.Qt.ScrollBarPolicy.ScrollBarAlwaysOff)
        self._transcript_edit.setStyleSheet(
            TRANSCRIPT_STYLE_TEMPLATE.format(
                font_size=30,
                font_family="Microsoft YaHei",
                font_color="#F5F5F5",
            )
        )
        main_layout.addWidget(self._transcript_edit, stretch=1)

        self._thread_pool = QtCore.QThreadPool.globalInstance()
        self._pending_save_path: Path | None = None
        self._suspend_text_signal = False
        self._saved_dialog = SavedTranscriptsDialog(Path.home() / SAVE_DIR_NAME, self, icon)
        self._transcript_edit.textChanged.connect(self._handle_text_changed)
        self._start_pause_button.clicked.connect(self._toggle_start_pause)
        self._settings_button.clicked.connect(self.settings_requested.emit)
        self._exit_button.clicked.connect(self.exit_requested.emit)
        self._autoscroll_button.clicked.connect(self._handle_autoscroll_toggled)
        self._clear_button.clicked.connect(self._handle_clear_clicked)
        self._save_button.clicked.connect(self._save_transcript)
        self._saved_view_button.clicked.connect(self._show_saved_dialog)

        self._is_streaming = False
        self._autoscroll_enabled = True
        self._autoscroll_button.setChecked(True)
        self._update_controls(False)
        self._update_autoscroll_button()

    # Public API ---------------------------------------------------------

    def set_streaming_state(self, streaming: bool) -> None:
        self._is_streaming = streaming
        self._update_controls(streaming)

    def apply_display_config(
        self,
        *,
        font_family: str,
        font_size: int,
        font_color: str,
        opacity: float,
    ) -> None:
        safe_color = font_color or "#F5F5F5"
        style = TRANSCRIPT_STYLE_TEMPLATE.format(
            font_size=max(14, font_size),
            font_family=font_family or "Microsoft YaHei",
            font_color=safe_color,
        )
        self._transcript_edit.setStyleSheet(style)
        self.setWindowOpacity(max(0.1, min(opacity, 1.0)))

    def set_transcript(self, text: str) -> None:
        self._suspend_text_signal = True
        self._transcript_edit.setPlainText(text)
        self._suspend_text_signal = False
        if self._autoscroll_enabled:
            self._move_cursor_to_end()

    def append_transcript(self, text: str) -> None:
        if not text:
            return
        self._suspend_text_signal = True
        cursor = self._transcript_edit.textCursor()
        cursor.movePosition(QtGui.QTextCursor.MoveOperation.End)
        cursor.insertText(text)
        self._transcript_edit.setTextCursor(cursor)
        self._suspend_text_signal = False
        if self._autoscroll_enabled:
            self._transcript_edit.ensureCursorVisible()

    def clear_transcript(self) -> None:
        self._suspend_text_signal = True
        self._transcript_edit.clear()
        self._suspend_text_signal = False
        if self._autoscroll_enabled:
            self._move_cursor_to_end()

    # Internal helpers ---------------------------------------------------

    def _handle_text_changed(self) -> None:
        if self._suspend_text_signal:
            return
        self.transcript_modified.emit(self._transcript_edit.toPlainText())

    def _toggle_start_pause(self) -> None:
        if self._is_streaming:
            self.pause_requested.emit()
        else:
            self.start_requested.emit()

    def _handle_autoscroll_toggled(self) -> None:
        self._autoscroll_enabled = self._autoscroll_button.isChecked()
        self._update_autoscroll_button()
        if self._autoscroll_enabled:
            self._move_cursor_to_end()

    def _handle_clear_clicked(self) -> None:
        self.clear_transcript()
        self.history_cleared.emit()

    def _update_autoscroll_button(self) -> None:
        label = "自动滚动：开" if self._autoscroll_enabled else "自动滚动：关"
        self._autoscroll_button.setText(label)
        self._autoscroll_button.setChecked(self._autoscroll_enabled)

    def _save_transcript(self) -> None:
        if self._pending_save_path is not None:
            return
        text = self._transcript_edit.toPlainText()
        if not text.strip():
            QtWidgets.QMessageBox.information(self, "保存字幕", "当前没有可保存的字幕。")
            return
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        target_dir = Path.home() / SAVE_DIR_NAME
        target_file = target_dir / f"浮光译影字幕_{timestamp}.md"

        task = _SaveTranscriptTask(target_file, text)
        task.signals.success.connect(self._handle_save_success)
        task.signals.failure.connect(self._handle_save_failure)

        self._pending_save_path = target_file
        self._save_button.setEnabled(False)
        self._save_button.setText("保存中…")
        self._thread_pool.start(task)

    def _handle_save_success(self, filepath: str) -> None:
        self._finalize_save()
        QtWidgets.QMessageBox.information(self, "保存成功", f"字幕已保存到:\n{filepath}")

    def _handle_save_failure(self, error: str) -> None:
        path = str(self._pending_save_path) if self._pending_save_path else ""
        self._finalize_save()
        QtWidgets.QMessageBox.critical(self, "保存失败", f"无法保存到 {path}\n原因：{error}")

    def _finalize_save(self) -> None:
        self._pending_save_path = None
        self._save_button.setEnabled(True)
        self._save_button.setText("保存为 .md")

    def _show_saved_dialog(self) -> None:
        self._saved_dialog.refresh()
        self._saved_dialog.show()
        self._saved_dialog.raise_()
        self._saved_dialog.activateWindow()

    def _update_controls(self, streaming: bool) -> None:
        if streaming:
            self._start_pause_button.setText("⏸ 暂停")
            self._start_pause_button.setStyleSheet(PAUSE_STYLE)
            self._status_label.setText("翻译中…")
            self._status_label.setStyleSheet(STATUS_ACTIVE_STYLE)
        else:
            self._start_pause_button.setText("▶ 开始")
            self._start_pause_button.setStyleSheet(PRIMARY_STYLE)
            self._status_label.setText("未开始")
            self._status_label.setStyleSheet(STATUS_IDLE_STYLE)

    def _move_cursor_to_end(self) -> None:
        cursor = self._transcript_edit.textCursor()
        cursor.movePosition(QtGui.QTextCursor.MoveOperation.End)
        self._transcript_edit.setTextCursor(cursor)
        self._transcript_edit.ensureCursorVisible()

    def contextMenuEvent(self, event: QtGui.QContextMenuEvent) -> None:
        menu = QtWidgets.QMenu(self)
        toggle_action = menu.addAction("暂停" if self._is_streaming else "开始")
        menu.addSeparator()
        auto_action = menu.addAction("关闭自动滚动" if self._autoscroll_enabled else "开启自动滚动")
        save_action = menu.addAction("快速保存 Markdown")
        saved_view_action = menu.addAction("查看已保存字幕")
        clear_action = menu.addAction("清除全部字幕")
        menu.addSeparator()
        settings_action = menu.addAction("设置…")
        exit_action = menu.addAction("退出")

        chosen = menu.exec(event.globalPos())
        if chosen == toggle_action:
            self._toggle_start_pause()
        elif chosen == auto_action:
            self._autoscroll_button.setChecked(not self._autoscroll_enabled)
            self._handle_autoscroll_toggled()
        elif chosen == save_action:
            self._save_transcript()
        elif chosen == saved_view_action:
            self._show_saved_dialog()
        elif chosen == clear_action:
            self._handle_clear_clicked()
        elif chosen == settings_action:
            self.settings_requested.emit()
        elif chosen == exit_action:
            self.exit_requested.emit()



