from __future__ import annotations

from PyQt6 import QtCore, QtGui, QtWidgets


class HistoryWindow(QtWidgets.QMainWindow):
    """Standard window that keeps the translation history in a read-only buffer."""

    def __init__(self) -> None:
        super().__init__()
        self.setWindowTitle("翻译历史")
        self.resize(640, 480)

        self._text_edit = QtWidgets.QTextEdit(self)
        self._text_edit.setReadOnly(True)
        self._text_edit.setLineWrapMode(QtWidgets.QTextEdit.LineWrapMode.WidgetWidth)
        font = self._text_edit.font()
        font.setPointSize(12)
        self._text_edit.setFont(font)

        central = QtWidgets.QWidget(self)
        layout = QtWidgets.QVBoxLayout(central)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(self._text_edit)
        self.setCentralWidget(central)

    @QtCore.pyqtSlot(str)
    def append_entry(self, text: str) -> None:
        cursor = self._text_edit.textCursor()
        cursor.movePosition(QtGui.QTextCursor.MoveOperation.End)
        cursor.insertText(text.strip())
        cursor.insertBlock()
        self._text_edit.setTextCursor(cursor)
        self._text_edit.ensureCursorVisible()

    def clear(self) -> None:
        self._text_edit.clear()
