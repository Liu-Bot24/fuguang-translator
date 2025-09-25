from __future__ import annotations

from PyQt6 import QtCore, QtGui, QtWidgets

from ..config import AppConfig, DashScopeConfig, DisplayConfig


class SettingsDialog(QtWidgets.QDialog):
    def __init__(self, config: AppConfig, parent: QtWidgets.QWidget | None = None) -> None:
        super().__init__(parent)
        self.setWindowTitle("设置")
        self._config = config

        self._init_ui()
        self._load_config(config)

    def _init_ui(self) -> None:
        layout = QtWidgets.QVBoxLayout(self)
        form = QtWidgets.QFormLayout()

        self._api_key = QtWidgets.QLineEdit(self)
        self._api_key.setEchoMode(QtWidgets.QLineEdit.EchoMode.Password)
        self._model = QtWidgets.QLineEdit(self)
        self._target_language = QtWidgets.QLineEdit(self)

        self._font_combo = QtWidgets.QFontComboBox(self)
        self._font_size = QtWidgets.QSpinBox(self)
        self._font_size.setRange(10, 96)

        self._font_color = QtWidgets.QLineEdit(self)
        self._font_color_button = QtWidgets.QPushButton("选择颜色", self)
        self._font_color_button.clicked.connect(self._choose_color)

        color_layout = QtWidgets.QHBoxLayout()
        color_layout.addWidget(self._font_color)
        color_layout.addWidget(self._font_color_button)

        self._opacity_slider = QtWidgets.QSlider(QtCore.Qt.Orientation.Horizontal, self)
        self._opacity_slider.setRange(10, 100)
        self._opacity_value_label = QtWidgets.QLabel(self)
        self._opacity_slider.valueChanged.connect(self._update_opacity_label)

        opacity_layout = QtWidgets.QHBoxLayout()
        opacity_layout.addWidget(self._opacity_slider)
        opacity_layout.addWidget(self._opacity_value_label)

        form.addRow("DashScope API Key", self._api_key)
        form.addRow("模型名", self._model)
        form.addRow("目标语言", self._target_language)
        form.addRow("字体", self._font_combo)
        form.addRow("字体大小", self._font_size)
        form.addRow("字体颜色", color_layout)
        form.addRow("背景透明度", opacity_layout)

        layout.addLayout(form)

        button_box = QtWidgets.QDialogButtonBox(
            QtWidgets.QDialogButtonBox.StandardButton.Cancel
            | QtWidgets.QDialogButtonBox.StandardButton.Save,
            parent=self,
        )
        button_box.rejected.connect(self.reject)
        button_box.accepted.connect(self.accept)
        layout.addWidget(button_box)

    def _load_config(self, config: AppConfig) -> None:
        self._api_key.setText(config.dashscope.api_key)
        self._model.setText(config.dashscope.model)
        self._target_language.setText(config.dashscope.target_language)

        self._font_combo.setCurrentFont(QtGui.QFont(config.display.font_family))
        self._font_size.setValue(config.display.font_size)
        self._font_color.setText(config.display.font_color)
        slider_value = int(max(0.1, min(config.display.background_opacity, 1.0)) * 100)
        self._opacity_slider.setValue(slider_value)
        self._update_opacity_label(slider_value)

    def _choose_color(self) -> None:
        current = QtGui.QColor(self._font_color.text())
        color = QtWidgets.QColorDialog.getColor(current, self, "选择字体颜色")
        if color.isValid():
            self._font_color.setText(color.name())

    def _update_opacity_label(self, value: int) -> None:
        self._opacity_value_label.setText(f"{value / 100:.2f}")

    def result_config(self) -> AppConfig:
        dashscope = DashScopeConfig(
            api_key=self._api_key.text().strip(),
            model=self._model.text().strip() or "qwen3-livetranslate-flash-realtime",
            target_language=self._target_language.text().strip() or "zh",
        )
        display = DisplayConfig(
            font_family=self._font_combo.currentFont().family(),
            font_size=self._font_size.value(),
            font_color=self._font_color.text().strip() or "#FFFFFF",
            background_opacity=self._opacity_slider.value() / 100.0,
        )
        return AppConfig(dashscope=dashscope, display=display)
