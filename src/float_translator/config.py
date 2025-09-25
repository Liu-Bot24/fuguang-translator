from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import configparser


CONFIG_FILE = Path(__file__).resolve().parent.parent.parent / "config.ini"


@dataclass
class DashScopeConfig:
    api_key: str = ""
    model: str = "qwen3-livetranslate-flash-realtime"
    target_language: str = "zh"


@dataclass
class DisplayConfig:
    font_family: str = "Microsoft YaHei"
    font_size: int = 28
    font_color: str = "#FFFFFF"
    background_opacity: float = 0.5


@dataclass
class AppConfig:
    dashscope: DashScopeConfig
    display: DisplayConfig


class ConfigManager:
    def __init__(self, path: Optional[Path] = None) -> None:
        self._path = path or CONFIG_FILE
        self._parser = configparser.ConfigParser()

    def load(self) -> AppConfig:
        if self._path.exists():
            self._parser.read(self._path, encoding="utf-8")
        dashscope = DashScopeConfig(
            api_key=self._parser.get("dashscope", "api_key", fallback=""),
            model=self._parser.get(
                "dashscope",
                "model",
                fallback="qwen3-livetranslate-flash-realtime",
            ),
            target_language=self._parser.get("dashscope", "target_language", fallback="zh"),
        )
        display = DisplayConfig(
            font_family=self._parser.get("display", "font_family", fallback="Microsoft YaHei"),
            font_size=self._parser.getint("display", "font_size", fallback=28),
            font_color=self._parser.get("display", "font_color", fallback="#FFFFFF"),
            background_opacity=self._parser.getfloat("display", "background_opacity", fallback=0.5),
        )
        return AppConfig(dashscope=dashscope, display=display)

    def save(self, config: AppConfig) -> None:
        if "dashscope" not in self._parser:
            self._parser.add_section("dashscope")
        if "display" not in self._parser:
            self._parser.add_section("display")
        self._parser.set("dashscope", "api_key", config.dashscope.api_key)
        self._parser.set("dashscope", "model", config.dashscope.model)
        self._parser.set(
            "dashscope", "target_language", config.dashscope.target_language
        )
        self._parser.set("display", "font_family", config.display.font_family)
        self._parser.set("display", "font_size", str(config.display.font_size))
        self._parser.set("display", "font_color", config.display.font_color)
        self._parser.set(
            "display", "background_opacity", str(config.display.background_opacity)
        )
        with self._path.open("w", encoding="utf-8") as fh:
            self._parser.write(fh)
