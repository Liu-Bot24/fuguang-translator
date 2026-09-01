<div align="center">

# 流声字幕 - 基于 ASR 与 LLM 的流媒体视频字幕生成与翻译

![Stars](https://img.shields.io/github/stars/Liu-Bot24/liusheng-subtitles?style=flat&label=Stars&cache=20260704) ![Forks](https://img.shields.io/github/forks/Liu-Bot24/liusheng-subtitles?style=flat&label=Forks&cache=20260704) ![Views 14d](https://github-stats.liu-qi.cn/api/badge/Liu-Bot24/liusheng-subtitles/views14d.svg?v=4) ![Clones 14d](https://github-stats.liu-qi.cn/api/badge/Liu-Bot24/liusheng-subtitles/clones14d.svg?v=4) ![Downloads](https://img.shields.io/github/downloads/Liu-Bot24/liusheng-subtitles/total?style=flat&label=Downloads&cache=20260704) ![Release](https://img.shields.io/github/v/release/Liu-Bot24/liusheng-subtitles?style=flat&label=Release&cache=20260704)

![流声字幕预览](docs/assets/github-preview.jpg)

Languages: [简体中文](README.md) · [English](README-en.md)

</div>

流声字幕是一款 Chrome 扩展，用来给网页视频生成字幕并翻译。适合没有字幕、字幕缺失，或需要把外语内容翻译成所选目标语言的流媒体影视、动漫、课程、访谈和直播回放。

打开视频页面后，流声字幕会在侧边栏中显示可处理的视频来源。用户选择识别服务和翻译模型后，就可以生成原文字幕、译文字幕或双语字幕，并把字幕显示到网页播放器上。

## 0.1.6 更新内容

- 将长时间识别与翻译迁移到持久化的 offscreen 执行链路，MV3 后台进程重启后可根据本机任务状态继续同一任务。
- 停止任务会中断正在进行的识别与翻译请求，并跟踪 FunASR 远端取消；付费请求保存恢复检查点，消息确认丢失时不会盲目重复提交。
- 切换浏览器标签页后，侧边栏会自动恢复该页面的任务；翻译请求默认超时由 90 秒提高到 120 秒。
- 提升 HLS、DASH、MSE 与直连媒体的执行稳定性：按来源保留必要请求头、串行执行 Web FFmpeg 抽取，并安全恢复页面媒体监听钩子。
- 本地文件任务可在 Chrome 权限仍有效时复用只读文件句柄进行重试或重新抽取；临时任务、音频和付费响应增加本机自动清理策略。

## 功能

- 自动发现当前网页中的视频来源。
- 支持浏览器中直接打开的本地视频文件。
- 生成原文字幕，并翻译成目标语言。
- 支持译文、原文、双语三种显示方式。
- 支持网页浮层字幕和侧边栏字幕列表。
- 支持逐条编辑译文、校正字幕时间轴，并删除错误字幕段。
- 支持导入 SRT、VTT、ASS/SSA 和插件 JSON 字幕。
- 支持导出 SRT 字幕。
- 支持本地字幕缓存，重新打开同一页面时可以直接加载已有字幕。
- 支持 OpenAI Whisper、Groq Whisper、xAI Grok、Fun-ASR 和自定义识别接口。
- 支持 OpenAI-compatible、Anthropic-compatible 等 LLM 翻译接口。

## 演示截图

![哔哩哔哩视频 / 配置界面](docs/assets/readme/bilibili-settings-demo.jpg)

*哔哩哔哩视频 / 配置界面*

![TED视频 / 主界面](docs/assets/readme/ted-task-demo.jpg)

*TED视频 / 主界面*

![X / 完整字幕](docs/assets/readme/x-full-subtitles-demo.jpg)

*X / 完整字幕*

![ニコニコ動画 / 全屏播放](docs/assets/readme/niconico-fullscreen-demo.jpg)

*ニコニコ動画 / 全屏播放*

## 安装

### 从 Chrome Web Store 安装

推荐直接从 Chrome Web Store 安装：

[安装流声字幕](https://chromewebstore.google.com/detail/ipcmkanhjahdpnacnjabkmlhggekkegm)

安装后打开网页视频页面，即可在浏览器侧边栏使用流声字幕。

### 从源码加载

1. 打开 Chrome 的 `chrome://extensions`。
2. 开启“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本仓库的 `extension/` 目录。

## 使用

1. 打开一个网页视频页面。
2. 打开流声字幕侧边栏。
3. 在“设置”里配置语音识别和翻译模型。
4. 在“任务与字幕”里选择视频来源和原音频语言。
5. 点击“开始抽取”，等待字幕生成。
6. 生成后可切换译文、原文或双语显示，也可以导出字幕文件。

如果任务中断，可以使用“继续”或“重试失败”。如果只想重新翻译，使用“重翻译字幕”；只有需要重新生成原文字幕时，才使用“重新 ASR”。

## 隐私

API 密钥、模型配置和字幕缓存保存在本机浏览器中。插件不会把网页视频、字幕缓存或 API 密钥发送给流声字幕开发者服务器。音频和字幕文本只会发送到用户自己配置的识别或翻译服务。

完整说明见 [隐私说明](docs/PRIVACY.md)。

## 说明

流声字幕只面向用户有权访问和处理的网页视频内容。请遵守内容版权、网站服务条款和平台政策。

部分加密、跨域受限或平台专用的视频来源可能无法处理。

## 开源致谢

感谢 [cat-catch](https://github.com/xifangczy/cat-catch) 的浏览器媒体嗅探实践。音频处理使用 [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm)。字幕时间和静音处理参考 faster-whisper、WhisperX、stable-ts 和 Speaches 的公开方案。

## 许可证

本项目使用 [MIT License](LICENSE) 开源。
