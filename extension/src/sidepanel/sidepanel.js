const MESSAGE = {
  ACTIVATE_PAGE: "FUGUANG_ACTIVATE_PAGE",
  GET_STATUS: "FUGUANG_GET_STATUS",
  GET_CANDIDATES: "FUGUANG_GET_CANDIDATES",
  START_PRELOAD_AUTO: "FUGUANG_START_PRELOAD_AUTO",
  RETRY_PRELOAD: "FUGUANG_RETRY_PRELOAD",
  RETRY_PRELOAD_CHUNKS: "FUGUANG_RETRY_PRELOAD_CHUNKS",
  RERUN_ASR_PRELOAD: "FUGUANG_RERUN_ASR_PRELOAD",
  RETRANSLATE_PRELOAD: "FUGUANG_RETRANSLATE_PRELOAD",
  RETRANSLATE_TRANSCRIPT: "FUGUANG_RETRANSLATE_TRANSCRIPT",
  CANCEL_PRELOAD: "FUGUANG_CANCEL_PRELOAD",
  CLEAR_PRELOAD_AUDIO_CACHE: "FUGUANG_CLEAR_PRELOAD_AUDIO_CACHE",
  CHECK_PRELOAD_JOB: "FUGUANG_CHECK_PRELOAD_JOB",
  GET_PRELOAD_VTT: "FUGUANG_GET_PRELOAD_VTT",
  GET_PRELOAD_TRANSCRIPT: "FUGUANG_GET_PRELOAD_TRANSCRIPT",
  GET_VIDEO_STATE: "FUGUANG_GET_VIDEO_STATE",
  ATTACH_VTT_TEXT: "FUGUANG_ATTACH_VTT_TEXT",
  DETACH_PRELOAD_VTT: "FUGUANG_DETACH_PRELOAD_VTT",
  CLEAR_PRELOAD_SUBTITLE_STATE: "FUGUANG_CLEAR_PRELOAD_SUBTITLE_STATE",
  SEEK_MEDIA: "FUGUANG_SEEK_MEDIA"
};

const DEFAULTS = {
  sourceLanguage: "auto",
  targetLanguage: "zh-CN",
  webFfmpegPerformance: "auto",
  translationWorkers: 3,
  chunkMinutes: 15,
  subtitleFontSize: 28,
  subtitleBackgroundOpacity: 78,
  subtitleOverlayEnabled: true,
  subtitleDisplayMode: "translated"
};
const MODEL_SETTINGS_VERSION = 5;
const UI_LOCALE_STORAGE_KEY = "fuguangUiLocale";
const DEFAULT_LOCALE = "zh";
const LOCALES = new Set(["en", "zh"]);
const I18N = {
  zh: {
    appName: "流声字幕",
    documentTitle: "流声字幕",
    appTagline: "基于 ASR 与 LLM 的生肉视频字幕生成器",
    currentTab: "当前标签页",
    languageLabel: "语言",
    tabsLabel: "页面切换",
    statusIdle: "待机",
    tabTask: "任务与字幕",
    tabSettings: "设置",
    mediaSources: "媒体源",
    refreshSources: "刷新源",
    readingSources: "正在读取当前页面媒体源。",
    taskTitle: "预加载任务",
    sourceLanguage: "原音频语言",
    sourceAuto: "自动识别",
    langChinese: "中文",
    langEnglish: "英语",
    langJapanese: "日语",
    langKorean: "韩语",
    langFrench: "法语",
    langGerman: "德语",
    langRussian: "俄语",
    langSpanish: "西班牙语",
    langPortuguese: "葡萄牙语",
    langItalian: "意大利语",
    targetChinese: "中文",
    targetEnglish: "英文",
    start: "开始",
    startExtract: "开始抽取",
    restartExtract: "重新抽取",
    retryFailed: "重试失败",
    retryFailedCount: "重试失败 {count}",
    retryFailedSegmentsCount: "重试失败识别分段 {count}",
    retry: "重试",
    continueTask: "继续",
    retranslate: "重翻译字幕",
    retranslateShort: "重翻译",
    rerunAsr: "重新 ASR",
    stop: "停止",
    clearAudio: "清音频缓存",
    refresh: "刷新",
    fullSubtitles: "完整字幕",
    overlayOn: "浮层开",
    overlayOff: "浮层关",
    subtitleModeTranslated: "译文",
    subtitleModeSource: "原文",
    subtitleModeBilingual: "双语",
    editSubtitles: "编辑",
    doneEditingSubtitles: "退出",
    editSubtitleText: "编辑译文",
    editSubtitleTime: "校正时间",
    deleteSubtitleCue: "删除本条",
    subtitleEditSaved: "字幕已自动保存。",
    subtitleCueDeleted: "已删除该字幕段。",
    subtitleInvalidTime: "时间格式不正确，或结束时间早于开始时间。",
    exportSrt: "导出SRT",
    importSubtitle: "导入",
    clearSubtitleCache: "清字幕缓存",
    taskDetails: "展开任务",
    collapseTask: "收起任务",
    subtitlePlaceholder: "字幕生成后会显示在这里。",
    taskBoundaryNote: "* 受 DRM 或平台策略保护影响，Netflix、YouTube 等部分媒体可能无法在浏览器插件内完成音频识别。请将流声字幕用于支持的内容，或期待本地版本。",
    asrSettings: "语音识别",
    configHelpLink: "配置说明",
    translationModel: "翻译模型",
    editingProfile: "正在编辑",
    addProfile: "新增档案",
    deleteProfile: "删除档案",
    profileName: "档案名称",
    apiBaseUrl: "接口地址",
    modelName: "模型名称",
    vadFilter: "VAD 过滤",
    auto: "自动",
    forceOn: "强制开启（自建）",
    off: "关闭",
    unsupported: "不支持",
    apiKey: "API 密钥",
    getApiKeyLink: "获取 API 密钥",
    modelNamePlaceholder: "输入或选择模型 ID",
    modelListLoading: "正在获取模型列表...",
    modelListLoaded: "已获取 {count} 个模型，可直接输入或从建议中选择。",
    modelListNeedsKey: "该平台需要先填写 API Key 才能获取模型列表。",
    modelListUnavailable: "该档案不支持自动获取模型列表，请手动填写模型名称。",
    modelListFetchFailed: "模型列表获取失败：{error}",
    apiFormat: "接口类型",
    openaiFormat: "OpenAI 兼容格式",
    anthropicFormat: "Anthropic 兼容格式",
    whisperCompatibleAsr: "Whisper 兼容接口",
    funAsrCompatibleAsr: "Fun-ASR 接口",
    targetLanguage: "目标语言",
    webFfmpegPerformance: "Web FFmpeg 性能",
    webFfmpegPerformanceAuto: "自动",
    webFfmpegPerformanceStable: "稳定优先",
    webFfmpegPerformanceFast: "速度优先",
    translationWorkers: "翻译并发",
    chunkMinutes: "字幕分组时长（分钟）",
    funAsrLongFileHint: "Fun-ASR 使用长文件链路：系统会按 2 小时以内粗切，完成后进入字幕翻译。",
    subtitleStyle: "字幕样式",
    fontSize: "文字大小（像素）",
    backgroundOpacity: "背景透明度 %",
    saveSettings: "保存设置",
    noTab: "没有可用的当前标签页。",
    oldJobMissing: "旧任务已失效。请重新提交任务。",
    noTrackedJob: "还没有正在跟踪的任务。",
    noTrackedPreloadJob: "还没有正在跟踪的预加载任务。",
    backendNoJob: "后台没有返回任务详情。请刷新或重新提交任务。",
    tabChangedReading: "当前标签页已变化，正在读取新的媒体源。",
    tabChangedCancel: "当前标签页已经变化，已取消提交。请确认媒体源后再开始。",
    tabChangedIgnore: "当前标签页已经变化，已忽略刚才返回的旧任务。",
    noCandidates: "还没有发现可抽取的媒体源。请确认页面里有视频，或播放/刷新页面后再试。",
    sourcesEmpty: "还没有发现可抽取的媒体源。",
    sourcesRefreshed: "已刷新 {count} 个媒体源。",
    sourcesSummary: "{count} 个来源，已选择第 {index} 个{hidden}。",
    sourcesHidden: "，另外 {count} 个已折叠在列表外",
    unnamedMedia: "未命名媒体",
    localMediaPermissionPrompt: "请选择当前正在播放的本地文件：{name}",
    localMediaPermissionReady: "已授权本地文件：{name}",
    submittingSource: "正在提交当前页面的媒体源...",
    taskSubmitted: "任务已提交。",
    waitingNewSubtitles: "正在等待新任务的字幕。",
    startFailedNoJob: "后台没有创建任务，请重新加载扩展后重试。",
    statusCompletedWarnings: "完成，有警告",
    statusCompleted: "字幕已完成",
    statusFailed: "任务失败",
    statusCancelled: "任务已停止",
    statusRunning: "处理中",
    jobExtractingTranslating: "正在边抽边译",
    jobAsrTranslation: "正在生成字幕",
    jobRetryFailed: "正在重试失败分段",
    jobPreloading: "正在预加载音频",
    stageQueued: "排队中",
    stageExtracting: "抽取",
    stageExtractingTranslating: "边抽边译",
    stageAsr: "语音识别",
    stageAsrTranslation: "字幕生成",
    stageRetryFailed: "重试失败",
    stageRetryTranslation: "重翻译",
    stageTranslating: "翻译",
    stageTranslated: "完成",
    stageCompleted: "完成",
    stageCancelled: "已停止",
    stageFailed: "失败",
    stageProcessing: "处理中",
    chunkQueued: "待识别",
    chunkAsr: "识别",
    chunkAsrDone: "待翻译",
    chunkTranslation: "翻译",
    chunkCompleted: "完成",
    chunkPartial: "部分完成",
    chunkFailed: "失败",
    chunkStopped: "停止",
    metricExtract: "抽取",
    metricAsrTranslation: "字幕进度",
    metricCurrentStep: "当前步骤",
    metricChunkMinutes: "字幕分组时长",
    metricLongFileChunk: "长文件分段",
    metricReady: "已可用",
    metricDoneChunks: "分组完成",
    metricTranslating: "翻译中",
    metricTranslationWorkers: "翻译并发",
    metricFailed: "失败",
    metricElapsed: "耗时",
    audioExtract: "音频抽取",
    asrTranslation: "字幕进度",
    minutes: "{count} 分钟",
    maxHours: "最长 {count} 小时",
    maxMinutes: "最长 {count} 分钟",
    taskSubtitle: "任务 {id} · {source}",
    noSpeech: "无语音",
    sourceSegments: "原文 {count}",
    translatedSegments: "译文 {count}",
    asrFailures: "{count} 个音频分段识别失败",
    attemptCount: "第 {count} 次尝试",
    waitingDuration: "已等待 {duration}",
    waitingFirstChunk: "等待首个音频切片生成",
    waitingFirstLongFileChunk: "等待长文件音频生成",
    readyAudio: "已生成 {duration} 可处理音频",
    internalChunks: "内部媒体切片 {done}/{total}",
    downloadSegments: "下载媒体切片 {done}/{total}",
    completedPercent: "100%",
    failedShort: "失败",
    jsonError: "模型返回内容无法解析。建议降低翻译并发，或切换到更稳定的翻译模型后重试。",
    noSubtitleItems: "模型没有返回字幕条目。可以重试这段任务。",
    retryPreloadMessage: "正在重试失败分段...",
    reuseSourceMessage: "正在继续翻译...",
    reuseAudioMessage: "正在继续识别...",
    continueTaskMessage: "正在继续处理任务...",
    rerunAsrMessage: "正在重新识别音频，会复用音频缓存并清除旧 ASR 原文和旧译文。",
    retranslateOnlyMessage: "正在重新翻译字幕，不会重新识别音频...",
    retranslateCacheMessage: "正在使用本地缓存原文重新翻译，不会重新识别音频...",
    retryChunkMessage: "正在重试第 {index} 个失败分段...",
    retranslateChunkMessage: "正在重翻译第 {index} 个分段...",
    retrySubmitted: "已提交失败分段重试。",
    rerunAsrSubmitted: "已提交重新 ASR。",
    retranslateSubmitted: "已提交字幕重翻译。",
    retryChunkSubmitted: "已提交第 {index} 个失败分段重试。",
    retranslateChunkSubmitted: "已提交第 {index} 个分段重翻译。",
    stoppingTask: "正在停止任务...",
    stoppedTask: "任务已停止。",
    noAudioCacheTask: "没有可清理音频缓存的任务。",
    runningNoClearAudio: "任务仍在运行中，请先停止或等待结束。",
    clearingAudio: "正在清除当前任务的音频缓存...",
    audioCleared: "当前任务音频缓存已清除。",
    subtitleEmptyFile: "字幕文件为空。",
    noRealTranslationMode: "当前模式下没有可显示的字幕。",
    cueJumpTitle: "双击跳转到这句字幕",
    seekDone: "已跳转到字幕时间点。",
    cacheLoaded: "已加载本地缓存：{title}",
    unnamedSubtitle: "未命名字幕",
    bilingualNeedsSource: "双语显示需要原文轨。请重新生成字幕，或导入带原文的字幕文件。",
    onlyTranslationTrack: "这份字幕只有译文轨。",
    sourcePreview: "字幕会先显示原文，译文完成后自动更新。",
    partialTranslationPreview: "部分译文已完成，剩余句子会暂时显示原文。",
    partialTranslationReady: "第 {done}/{total} 部分翻译已完成，字幕已可先行观看，剩余翻译仍在后台继续。",
    noPlayer: "当前页面没有可挂载字幕的播放器。",
    noExportSubtitle: "还没有可导出的字幕。",
    noExportRealTranslation: "当前模式下还没有可导出的字幕。",
    srtExported: "SRT 字幕已导出。",
    importNoSubtitle: "导入文件没有可用字幕。",
    importNoContext: "导入文件缺少网页或媒体信息，无法保存到当前页面。",
    importDone: "已导入 {format} 字幕，并保存到当前页面。",
    importFailed: "导入失败：{error}",
    fuguangJson: "流声字幕 JSON",
    subtitleGeneric: "字幕",
    noCacheLocation: "当前页面没有可定位的字幕缓存。",
    noSavedSubtitleCache: "当前页面没有已保存的字幕缓存。",
    subtitleCacheCleared: "已清除当前页面字幕缓存。",
    subtitleCacheClearedCount: "已清除当前页面字幕缓存（{count} 条）。",
    subtitleCacheClearedBackendFailed: "已清除当前页面字幕缓存（{count} 条），但页面状态同步失败：{error}",
    subtitleCacheDisplayCleared: "当前页面没有已保存的字幕缓存，已清除当前显示的缓存字幕。",
    subtitleCacheDisplayClearedBackendFailed: "当前页面没有已保存的字幕缓存，已清除当前显示的缓存字幕，但页面状态同步失败：{error}",
    subtitleCacheClearFailed: "清除字幕缓存失败：{error}",
    backgroundClearFailed: "后台没有完成字幕状态清理。",
    noSavedCacheAndDisplayCleared: "当前页面没有已保存的字幕缓存，已清除当前显示。",
    settingsSaved: "设置已保存。新任务会使用当前配置。",
    profileAdded: "已新增档案，请按需要修改并保存。",
    profileDeleted: "已删除当前档案。保存设置后会更新本机存储。",
    unnamedProfile: "未命名档案",
    localOnlyPlaceholder: "只保存在本机浏览器",
    asrKeyHint: "API 密钥只保存在本机浏览器。",
    llmKeyHint: "API 密钥只保存在本机浏览器。",
    startTitle: "从当前媒体源抽取音频并生成字幕。",
    restartTitle: "从选中的媒体源重新抽取音频并创建新任务。",
    retryNeedsExtractTitle: "音频缓存已清除，需要重新抽取全部。",
    continueTaskTitle: "从当前卡住的位置继续，不改变抽取、ASR、翻译的边界。",
    rerunAsrTitle: "复用已抽取音频重新识别；会清除旧 ASR 原文和旧译文。",
    rerunAsrNeedsAudioTitle: "没有可复用音频缓存，请重新抽取。",
    continueTranslateTitle: "继续翻译已有原文，不重新识别音频。",
    continueAsrTitle: "继续识别已抽取的音频，不重新下载媒体。",
    retryFailedTitle: "只重试当前任务里的失败分段。",
    retranslateTitle: "只重新翻译已有原文。",
    clearAudioRunningTitle: "任务运行中不能清理音频缓存。",
    clearAudioAgainTitle: "再次清除当前任务的浏览器音频缓存；字幕缓存不受影响。",
    clearAudioTitle: "只清除当前任务的浏览器音频缓存；字幕缓存不受影响。",
    chunkRetryRunningTitle: "当前任务仍在运行，结束后可单独重试。",
    chunkRetryTitle: "重新识别并翻译这个失败分段。",
    chunkRetranslateTitle: "只重跑这个翻译分段。",
    roleAudio: "音频轨",
    roleVideo: "视频轨",
    rolePlaylist: "播放列表",
    roleMedia: "媒体",
    sourcePlanKind: "计划 {kind}",
    sourcePlanInput: "输入 {type}",
    sourcePlanAdapter: "适配 {name}",
    sourcePlanContainer: "容器 {name}",
    sourcePlanDiagnosticOnly: "仅诊断",
    sourceRequestHeaders: "请求头",
    sourceRequest: "请求",
    sourceResponse: "响应",
    sourcePage: "页面",
    sourceMediaElement: "播放器",
    sourceJsonParse: "页面数据",
    sourceHlsParse: "HLS 列表",
    sourceDashParse: "DASH 列表",
    folded: "折叠 {count}",
    waitFirstSegment: "等待首段",
    waitFirstLongFileSegment: "等待长文件音频",
    activeProcessing: "{count} 处理中",
    failedCount: "{count} 失败",
    contextInvalidated: "扩展上下文已失效，请重新加载扩展并刷新当前页面。",
    receivingEndMissing: "页面脚本还没有准备好，请刷新当前页面后重试。",
    portClosed: "后台响应中断，请重试。",
    unknownError: "未知错误",
    backendNoResponse: "扩展后台暂时没有响应：{error}"
  },
  en: {
    appName: "LiuSheng Subtitles",
    documentTitle: "LiuSheng Subtitles",
    appTagline: "Raw video subtitle generator powered by ASR and LLM",
    currentTab: "Current tab",
    languageLabel: "Language",
    tabsLabel: "Tabs",
    statusIdle: "Idle",
    tabTask: "Tasks & Subtitles",
    tabSettings: "Settings",
    mediaSources: "Media Sources",
    refreshSources: "Refresh Sources",
    readingSources: "Reading media sources from this page.",
    taskTitle: "Preload Task",
    sourceLanguage: "Source Language",
    sourceAuto: "Auto detect",
    langChinese: "Chinese",
    langEnglish: "English",
    langJapanese: "Japanese",
    langKorean: "Korean",
    langFrench: "French",
    langGerman: "German",
    langRussian: "Russian",
    langSpanish: "Spanish",
    langPortuguese: "Portuguese",
    langItalian: "Italian",
    targetChinese: "Chinese",
    targetEnglish: "English",
    start: "Start",
    startExtract: "Start",
    restartExtract: "Restart",
    retryFailed: "Retry Failed",
    retryFailedCount: "Retry Failed {count}",
    retryFailedSegmentsCount: "Retry Failed ASR {count}",
    retry: "Retry",
    continueTask: "Continue",
    retranslate: "Retranslate",
    retranslateShort: "Retranslate",
    rerunAsr: "Rerun ASR",
    stop: "Stop",
    clearAudio: "Clear Audio",
    refresh: "Refresh",
    fullSubtitles: "Full Subtitles",
    overlayOn: "Overlay On",
    overlayOff: "Overlay Off",
    subtitleModeTranslated: "Translation",
    subtitleModeSource: "Source",
    subtitleModeBilingual: "Bilingual",
    editSubtitles: "Edit",
    doneEditingSubtitles: "Exit",
    editSubtitleText: "Edit translation",
    editSubtitleTime: "Adjust timing",
    deleteSubtitleCue: "Delete cue",
    subtitleEditSaved: "Subtitle edits saved automatically.",
    subtitleCueDeleted: "Deleted this subtitle cue.",
    subtitleInvalidTime: "Invalid time format, or the end time is before the start time.",
    exportSrt: "Export SRT",
    importSubtitle: "Import",
    clearSubtitleCache: "Clear Subtitles",
    taskDetails: "Show Task",
    collapseTask: "Hide Task",
    subtitlePlaceholder: "Subtitles will appear here.",
    taskBoundaryNote: "* DRM or platform policies may prevent audio recognition for some media, including Netflix and YouTube. Please use Liusheng Subtitles with supported content, or look forward to the local version.",
    asrSettings: "Speech Recognition",
    configHelpLink: "Configuration Guide",
    translationModel: "Translation Model",
    editingProfile: "Editing",
    addProfile: "Add Profile",
    deleteProfile: "Delete Profile",
    profileName: "Profile Name",
    apiBaseUrl: "API Base URL",
    modelName: "Model",
    vadFilter: "VAD Filter",
    auto: "Auto",
    forceOn: "Force On (self-hosted)",
    off: "Off",
    unsupported: "Not Supported",
    apiKey: "API Key",
    getApiKeyLink: "Get API key",
    modelNamePlaceholder: "Type or choose a model ID",
    modelListLoading: "Loading model list...",
    modelListLoaded: "Loaded {count} models. Type or choose from suggestions.",
    modelListNeedsKey: "Enter an API key before loading this provider's model list.",
    modelListUnavailable: "This profile does not support automatic model list loading. Enter the model manually.",
    modelListFetchFailed: "Could not load model list: {error}",
    apiFormat: "API Type",
    openaiFormat: "OpenAI Compatible",
    anthropicFormat: "Anthropic Compatible",
    whisperCompatibleAsr: "Whisper-compatible API",
    funAsrCompatibleAsr: "Fun-ASR API",
    targetLanguage: "Target Language",
    webFfmpegPerformance: "Web FFmpeg Performance",
    webFfmpegPerformanceAuto: "Auto",
    webFfmpegPerformanceStable: "Stability First",
    webFfmpegPerformanceFast: "Speed First",
    translationWorkers: "Translation Workers",
    chunkMinutes: "Subtitle Group Length (min)",
    funAsrLongFileHint: "Fun-ASR uses a long-file workflow: audio is coarsely split under two hours, then subtitles are translated.",
    subtitleStyle: "Subtitle Style",
    fontSize: "Font Size (px)",
    backgroundOpacity: "Background Opacity %",
    saveSettings: "Save Settings",
    noTab: "No active tab is available.",
    oldJobMissing: "The previous task is no longer available. Start a new task.",
    noTrackedJob: "No task is being tracked.",
    noTrackedPreloadJob: "No preload task is being tracked.",
    backendNoJob: "The background service did not return task details. Refresh or start again.",
    tabChangedReading: "The current tab changed. Reading sources from the new page.",
    tabChangedCancel: "The current tab changed, so the request was cancelled.",
    tabChangedIgnore: "The current tab changed. The previous result was ignored.",
    noCandidates: "No usable media source was found. Play or refresh the page, then try again.",
    sourcesEmpty: "No usable media source was found.",
    sourcesRefreshed: "Refreshed {count} media source(s).",
    sourcesSummary: "{count} source(s), selected #{index}{hidden}.",
    sourcesHidden: ", {count} more folded",
    unnamedMedia: "Untitled media",
    localMediaPermissionPrompt: "Choose the local file currently playing: {name}",
    localMediaPermissionReady: "Local file authorized: {name}",
    submittingSource: "Submitting the selected media source...",
    taskSubmitted: "Task submitted.",
    waitingNewSubtitles: "Waiting for subtitles from the new task.",
    startFailedNoJob: "The background service did not create a task. Reload the extension and try again.",
    statusCompletedWarnings: "Completed, with warnings",
    statusCompleted: "Subtitles ready",
    statusFailed: "Task failed",
    statusCancelled: "Stopped",
    statusRunning: "Processing",
    jobExtractingTranslating: "Extracting and translating",
    jobAsrTranslation: "Generating subtitles",
    jobRetryFailed: "Retrying failed segments",
    jobPreloading: "Preloading audio",
    stageQueued: "Queued",
    stageExtracting: "Extracting",
    stageExtractingTranslating: "Extracting + translating",
    stageAsr: "Speech recognition",
    stageAsrTranslation: "Subtitle generation",
    stageRetryFailed: "Retrying failed",
    stageRetryTranslation: "Retranslating",
    stageTranslating: "Translating",
    stageTranslated: "Done",
    stageCompleted: "Done",
    stageCancelled: "Stopped",
    stageFailed: "Failed",
    stageProcessing: "Processing",
    chunkQueued: "Waiting for ASR",
    chunkAsr: "ASR",
    chunkAsrDone: "To translate",
    chunkTranslation: "Translating",
    chunkCompleted: "Done",
    chunkPartial: "Partial",
    chunkFailed: "Failed",
    chunkStopped: "Stopped",
    metricExtract: "Extract",
    metricAsrTranslation: "Subtitle Progress",
    metricCurrentStep: "Current Step",
    metricChunkMinutes: "Subtitle Group Length",
    metricLongFileChunk: "Long-file Segment",
    metricReady: "Ready Audio",
    metricDoneChunks: "Groups Done",
    metricTranslating: "Translating",
    metricTranslationWorkers: "Translation Workers",
    metricFailed: "Failed",
    metricElapsed: "Elapsed",
    audioExtract: "Audio Extraction",
    asrTranslation: "Subtitle Progress",
    minutes: "{count} min",
    maxHours: "Up to {count} hr",
    maxMinutes: "Up to {count} min",
    taskSubtitle: "Task {id} · {source}",
    noSpeech: "No speech",
    sourceSegments: "Source {count}",
    translatedSegments: "Translated {count}",
    asrFailures: "{count} ASR segment(s) failed",
    attemptCount: "Attempt {count}",
    waitingDuration: "Waited {duration}",
    waitingFirstChunk: "Waiting for the first audio segment",
    waitingFirstLongFileChunk: "Waiting for long-file audio",
    readyAudio: "{duration} of audio ready",
    internalChunks: "Internal media segments {done}/{total}",
    downloadSegments: "Downloaded media segments {done}/{total}",
    completedPercent: "100%",
    failedShort: "Failed",
    jsonError: "The model response could not be parsed. Lower translation concurrency or switch to a more stable translation model.",
    noSubtitleItems: "The model did not return subtitle items. You can retry this segment.",
    retryPreloadMessage: "Retrying failed segments...",
    reuseSourceMessage: "Continuing translation...",
    reuseAudioMessage: "Continuing ASR...",
    continueTaskMessage: "Continuing the task...",
    rerunAsrMessage: "Rerunning ASR from cached audio and clearing the old ASR text and translation.",
    retranslateOnlyMessage: "Retranslating subtitles without running ASR again...",
    retranslateCacheMessage: "Retranslating from cached source without running ASR again...",
    retryChunkMessage: "Retrying failed segment #{index}...",
    retranslateChunkMessage: "Retranslating segment #{index}...",
    retrySubmitted: "Failed segment retry submitted.",
    rerunAsrSubmitted: "ASR rerun submitted.",
    retranslateSubmitted: "Subtitle retranslation submitted.",
    retryChunkSubmitted: "Failed segment #{index} retry submitted.",
    retranslateChunkSubmitted: "Segment #{index} retranslation submitted.",
    stoppingTask: "Stopping task...",
    stoppedTask: "Task stopped.",
    noAudioCacheTask: "No task has audio cache to clear.",
    runningNoClearAudio: "The task is still running. Stop it or wait for it to finish.",
    clearingAudio: "Clearing audio cache for this task...",
    audioCleared: "Audio cache cleared for this task.",
    subtitleEmptyFile: "The subtitle file is empty.",
    noRealTranslationMode: "No subtitles are available in this mode.",
    cueJumpTitle: "Double-click to seek to this subtitle",
    seekDone: "Jumped to subtitle time.",
    cacheLoaded: "Loaded local cache: {title}",
    unnamedSubtitle: "Untitled subtitles",
    bilingualNeedsSource: "Bilingual mode needs a source track. Regenerate subtitles or import a file with source text.",
    onlyTranslationTrack: "This subtitle file only has a translation track.",
    sourcePreview: "Source subtitles are shown first and will update as translations finish.",
    partialTranslationPreview: "Some translations are ready; remaining lines temporarily show source text.",
    partialTranslationReady: "Part {done}/{total} is translated. You can start watching while the remaining translation continues in the background.",
    noPlayer: "No subtitle-capable player was found on this page.",
    noExportSubtitle: "There are no subtitles to export yet.",
    noExportRealTranslation: "There are no subtitles to export in this mode yet.",
    srtExported: "SRT exported.",
    importNoSubtitle: "The imported file does not contain usable subtitles.",
    importNoContext: "The imported file does not contain page or media information for caching.",
    importDone: "Imported {format} subtitles and saved them for this page.",
    importFailed: "Import failed: {error}",
    fuguangJson: "LiuSheng Subtitles JSON",
    subtitleGeneric: "Subtitles",
    noCacheLocation: "No subtitle cache can be matched to this page.",
    noSavedSubtitleCache: "This page has no saved subtitle cache.",
    subtitleCacheCleared: "Subtitle cache cleared for this page.",
    subtitleCacheClearedCount: "Cleared {count} subtitle cache item(s).",
    subtitleCacheClearedBackendFailed: "Cleared {count} subtitle cache item(s), but page state sync failed: {error}",
    subtitleCacheDisplayCleared: "No saved cache was found; the currently displayed cached subtitles were cleared.",
    subtitleCacheDisplayClearedBackendFailed: "No saved cache was found; the displayed cached subtitles were cleared, but page state sync failed: {error}",
    subtitleCacheClearFailed: "Failed to clear subtitle cache: {error}",
    backgroundClearFailed: "The background service did not clear subtitle state.",
    noSavedCacheAndDisplayCleared: "No saved subtitle cache was found; current display was cleared.",
    settingsSaved: "Settings saved. New tasks will use this configuration.",
    profileAdded: "Profile added. Edit it as needed, then save.",
    profileDeleted: "Deleted the current profile. Save settings to update local storage.",
    unnamedProfile: "Untitled profile",
    localOnlyPlaceholder: "Stored in this browser only",
    asrKeyHint: "The API key stays in this browser.",
    llmKeyHint: "The API key stays in this browser.",
    startTitle: "Extract audio from the selected source and generate subtitles.",
    restartTitle: "Extract audio again from the selected source and create a new task.",
    retryNeedsExtractTitle: "Audio cache was cleared. Start a full extraction again.",
    continueTaskTitle: "Continue from the step where the task stopped without changing extraction, ASR, or translation boundaries.",
    rerunAsrTitle: "Run ASR again from extracted audio; old ASR text and translations will be cleared.",
    rerunAsrNeedsAudioTitle: "No reusable audio cache is available. Extract again first.",
    continueTranslateTitle: "Continue translating existing source text without running ASR again.",
    continueAsrTitle: "Continue ASR from extracted audio without downloading media again.",
    retryFailedTitle: "Retry only failed segments in this task.",
    retranslateTitle: "Retranslate existing source text only.",
    clearAudioRunningTitle: "Audio cache cannot be cleared while the task is running.",
    clearAudioAgainTitle: "Clear this task's browser audio cache again; subtitle cache is unchanged.",
    clearAudioTitle: "Clear this task's browser audio cache only; subtitle cache is unchanged.",
    chunkRetryRunningTitle: "This task is still running. Retry this segment after it finishes.",
    chunkRetryTitle: "Recognize and translate this failed segment again.",
    chunkRetranslateTitle: "Retranslate this segment only.",
    roleAudio: "Audio",
    roleVideo: "Video",
    rolePlaylist: "Playlist",
    roleMedia: "Media",
    sourcePlanKind: "Plan {kind}",
    sourcePlanInput: "Input {type}",
    sourcePlanAdapter: "Adapter {name}",
    sourcePlanContainer: "Container {name}",
    sourcePlanDiagnosticOnly: "diagnostic only",
    sourceRequestHeaders: "Request headers",
    sourceRequest: "Request",
    sourceResponse: "Response",
    sourcePage: "Page",
    sourceMediaElement: "Player",
    sourceJsonParse: "Page data",
    sourceHlsParse: "HLS playlist",
    sourceDashParse: "DASH playlist",
    folded: "Folded {count}",
    waitFirstSegment: "Waiting for first segment",
    waitFirstLongFileSegment: "Waiting for long-file audio",
    activeProcessing: "{count} active",
    failedCount: "{count} failed",
    contextInvalidated: "Extension context expired. Reload the extension and refresh this page.",
    receivingEndMissing: "The page script is not ready. Refresh this page and try again.",
    portClosed: "Background response was interrupted. Try again.",
    unknownError: "Unknown error",
    backendNoResponse: "Extension background did not respond: {error}"
  }
};
const LEGACY_MODEL_SYNC_KEYS = [
  "asrApiKey",
  "llmApiKey",
  "asrBaseUrl",
  "asrModel",
  "llmBaseUrl",
  "llmModel",
  "llmProviderType",
  "targetLanguage",
  "asrWorkers",
  "translationWorkers",
  "chunkMinutes"
];
const SUBTITLE_SYNC_KEYS = [
  "subtitleFontSize",
  "subtitleOverlayEnabled",
  "subtitleDisplayMode",
  "subtitleBackgroundOpacity"
];
const SUBTITLE_CACHE_SCHEMA_VERSION = 4;
const SUBTITLE_CACHE_STRICT_LEGACY_SCHEMA_VERSION = 3;
const SUBTITLE_CACHE_LEGACY_SCHEMA_VERSION = 2;
const SUBTITLE_USER_SCROLL_HOLD_MS = 8000;
const normalizeTargetLanguageValue = FuguangSidepanelLanguage.normalizeTargetLanguageValue;
const normalizeSourceLanguageValue = FuguangSidepanelLanguage.normalizeSourceLanguageValue;
const DEFAULT_ASR_PROFILE_ID = FuguangSidepanelProfiles.DEFAULT_ASR_PROFILE_ID;
const DEFAULT_LLM_PROFILE_ID = FuguangSidepanelProfiles.DEFAULT_LLM_PROFILE_ID;
const createEmptyProfile = FuguangSidepanelProfiles.createEmptyProfile;
const defaultCustomProfileName = FuguangSidepanelProfiles.defaultCustomProfileName;
const defaultProfiles = FuguangSidepanelProfiles.defaultProfiles;
const normalizeAsrVadFilterMode = FuguangSidepanelProfiles.normalizeAsrVadFilterMode;
const normalizeCustomProfileProviderType = FuguangSidepanelProfiles.normalizeCustomProfileProviderType;
const normalizeSelectedProfileId = FuguangSidepanelProfiles.normalizeSelectedProfileId;
const normalizeStoredProfiles = FuguangSidepanelProfiles.normalizeStoredProfiles;
const placeholderBaseUrl = FuguangSidepanelProfiles.placeholderBaseUrl;
const profileById = FuguangSidepanelProfiles.profileById;
const profilesForStorage = FuguangSidepanelProfiles.profilesForStorage;
const isBuiltInLlmProfile = FuguangSidepanelProfiles.isBuiltInLlmProfile;

const elements = {
  pageTitle: document.querySelector("#pageTitle"),
  status: document.querySelector("#status"),
  localeSwitch: document.querySelector("#localeSwitch"),
  localeEnglish: document.querySelector("#localeEnglish"),
  localeChinese: document.querySelector("#localeChinese"),
  tabsNav: document.querySelector("#tabsNav"),
  tabTask: document.querySelector("#tabTask"),
  tabSettings: document.querySelector("#tabSettings"),
  taskPanel: document.querySelector("#taskPanel"),
  settingsPanel: document.querySelector("#settingsPanel"),
  startPreload: document.querySelector("#startPreload"),
  rerunAsr: document.querySelector("#rerunAsr"),
  retryPreload: document.querySelector("#retryPreload"),
  retryTranslation: document.querySelector("#retryTranslation"),
  cancelPreload: document.querySelector("#cancelPreload"),
  clearAudioCache: document.querySelector("#clearAudioCache"),
  refresh: document.querySelector("#refresh"),
  refreshCandidates: document.querySelector("#refreshCandidates"),
  candidateSummary: document.querySelector("#candidateSummary"),
  candidateList: document.querySelector("#candidateList"),
  jobStatus: document.querySelector("#jobStatus"),
  subtitleList: document.querySelector("#subtitleList"),
  subtitleEditToggle: document.querySelector("#subtitleEditToggle"),
  subtitleOverlayToggle: document.querySelector("#subtitleOverlayToggle"),
  subtitleModeToggle: document.querySelector("#subtitleModeToggle"),
  exportSubtitle: document.querySelector("#exportSubtitle"),
  importSubtitle: document.querySelector("#importSubtitle"),
  clearSubtitleCache: document.querySelector("#clearSubtitleCache"),
  subtitleImportFile: document.querySelector("#subtitleImportFile"),
  subtitleNotice: document.querySelector("#subtitleNotice"),
  toggleTaskDetails: document.querySelector("#toggleTaskDetails"),
  saveSettings: document.querySelector("#saveSettings"),
  taskMessage: document.querySelector("#taskMessage"),
  message: document.querySelector("#message"),
  asrProfileId: document.querySelector("#asrProfileId"),
  asrProfileName: document.querySelector("#asrProfileName"),
  addAsrProfile: document.querySelector("#addAsrProfile"),
  deleteAsrProfile: document.querySelector("#deleteAsrProfile"),
  asrProviderTypeField: document.querySelector("#asrProviderTypeField"),
  asrProviderType: document.querySelector("#asrProviderType"),
  asrBaseUrl: document.querySelector("#asrBaseUrl"),
  asrModelField: document.querySelector("#asrModelField"),
  asrModel: document.querySelector("#asrModel"),
  asrVadFilterField: document.querySelector("#asrVadFilterField"),
  asrVadFilter: document.querySelector("#asrVadFilter"),
  asrApiKey: document.querySelector("#asrApiKey"),
  asrApiKeyHelpLink: document.querySelector("#asrApiKeyHelpLink"),
  asrApiKeyHint: document.querySelector("#asrApiKeyHint"),
  llmProfileId: document.querySelector("#llmProfileId"),
  llmProfileName: document.querySelector("#llmProfileName"),
  addLlmProfile: document.querySelector("#addLlmProfile"),
  deleteLlmProfile: document.querySelector("#deleteLlmProfile"),
  llmProviderType: document.querySelector("#llmProviderType"),
  llmBaseUrl: document.querySelector("#llmBaseUrl"),
  llmModel: document.querySelector("#llmModel"),
  llmModelSelect: document.querySelector("#llmModelSelect"),
  llmModelHint: document.querySelector("#llmModelHint"),
  llmApiKey: document.querySelector("#llmApiKey"),
  llmApiKeyHelpLink: document.querySelector("#llmApiKeyHelpLink"),
  llmApiKeyHint: document.querySelector("#llmApiKeyHint"),
  sourceLanguage: document.querySelector("#sourceLanguage"),
  targetLanguage: document.querySelector("#targetLanguage"),
  webFfmpegPerformance: document.querySelector("#webFfmpegPerformance"),
  translationWorkers: document.querySelector("#translationWorkers"),
  chunkMinutes: document.querySelector("#chunkMinutes"),
  funAsrLongFileHint: document.querySelector("#funAsrLongFileHint"),
  subtitleFontSize: document.querySelector("#subtitleFontSize"),
  subtitleBackgroundOpacity: document.querySelector("#subtitleBackgroundOpacity")
};

let activeTab = null;
let currentLocale = resolveInitialLocale();
let currentJobId = "";
let currentJob = null;
let renderedSubtitleJobId = "";
let pollTimer = 0;
let candidates = [];
let selectedCandidateKey = "";
let selectedCandidatePinned = false;
let asrProfiles = [];
let llmProfiles = [];
let currentAsrProfileId = "";
let currentLlmProfileId = "";
let llmModelListRequestId = 0;
let startRequestInFlight = false;
let retryRequestInFlight = false;
let asrRetryRequestInFlight = false;
let translationRetryRequestInFlight = false;
let subtitleCues = [];
let currentTranscript = null;
let currentSubtitleCacheEntry = null;
let subtitleDisplayMode = DEFAULTS.subtitleDisplayMode;
let subtitleOverlayEnabled = DEFAULTS.subtitleOverlayEnabled;
let subtitleEditMode = false;
let subtitleEditingTextIndex = -1;
let subtitleEditingTimeIndex = -1;
let subtitleEditingTextDraft = "";
let subtitleEditingTimeDraft = "";
let attachedSubtitleTabId = 0;
let attachedSubtitleSignature = "";
let renderedSubtitleSignature = "";
let subtitleCueSource = "";
let activeCueIndex = -1;
let manualSubtitleOverride = null;
let subtitleListPointerInside = false;
let subtitleListUserControlUntil = 0;
let subtitleFollowTimer = 0;
let subtitleFollowBusy = false;
let refreshStatusInFlight = false;
let subtitleLoadRequestId = 0;
let pendingSubtitleSignature = "";
let pendingSubtitlePromise = null;
let cachedSubtitleLoadedKey = "";
let cacheAutoLoadInFlight = false;
let taskDetailsExpanded = false;
let taskDetailsManuallyCollapsed = false;
let renderedCandidateSignature = "";
let lastActivatedTabKey = "";
let elapsedTicker = 0;
const clearedSubtitleJobIds = new Set();
const retryingChunks = new Set();

setSubtitleOutputRuntimeStateProvider(() => ({
  mode: subtitleDisplayMode,
  isRunning: isRunningJob(currentJob)
}));

document.addEventListener("DOMContentLoaded", init);
document.addEventListener("pointerdown", event => handleSubtitleInlineEditPointerDown(event), true);
elements.localeEnglish.addEventListener("click", () => setLocale("en"));
elements.localeChinese.addEventListener("click", () => setLocale("zh"));
elements.tabTask.addEventListener("click", () => showTab("task"));
elements.tabSettings.addEventListener("click", () => showTab("settings"));
elements.startPreload.addEventListener("click", () => startPreloadFromSidePanel());
elements.rerunAsr.addEventListener("click", () => rerunAsrFromSidePanel());
elements.retryPreload.addEventListener("click", () => retryPreloadFromSidePanel());
elements.retryTranslation.addEventListener("click", () => retryTranslationFromSidePanel());
elements.cancelPreload.addEventListener("click", () => cancelPreloadFromSidePanel());
elements.clearAudioCache.addEventListener("click", () => clearCurrentAudioCache());
elements.refresh.addEventListener("click", () => refreshStatus());
elements.refreshCandidates.addEventListener("click", () => refreshCandidates());
elements.subtitleOverlayToggle.addEventListener("click", () => toggleSubtitleOverlay());
elements.subtitleModeToggle.addEventListener("click", () => toggleSubtitleMode());
elements.subtitleEditToggle.addEventListener("click", () => toggleSubtitleEditMode());
elements.exportSubtitle.addEventListener("click", () => exportCurrentSubtitle());
elements.importSubtitle.addEventListener("click", () => elements.subtitleImportFile.click());
elements.clearSubtitleCache.addEventListener("click", () => clearCurrentSubtitleCache());
elements.subtitleImportFile.addEventListener("change", () => importSubtitleFile());
elements.toggleTaskDetails.addEventListener("click", () => toggleTaskDetails());
elements.saveSettings.addEventListener("click", () => saveSettings());
elements.sourceLanguage.addEventListener("change", () => saveSourceLanguageSetting());
elements.subtitleList.addEventListener("mouseenter", () => {
  subtitleListPointerInside = true;
});
elements.subtitleList.addEventListener("mouseleave", () => {
  subtitleListPointerInside = false;
});
elements.subtitleList.addEventListener("focusin", () => {
  subtitleListPointerInside = true;
});
elements.subtitleList.addEventListener("focusout", () => {
  subtitleListPointerInside = false;
});
elements.subtitleList.addEventListener("wheel", () => markSubtitleListUserControl(), { passive: true });
elements.subtitleList.addEventListener("touchstart", () => markSubtitleListUserControl(), { passive: true });
elements.subtitleList.addEventListener("pointerdown", () => markSubtitleListUserControl());
elements.subtitleList.addEventListener("scroll", () => {
  if (subtitleListPointerInside) {
    markSubtitleListUserControl();
  }
});
elements.asrProfileId.addEventListener("change", () => {
  saveProfileFields("asr", currentAsrProfileId);
  currentAsrProfileId = elements.asrProfileId.value;
  renderSelectedProfile("asr");
});
elements.addAsrProfile.addEventListener("click", () => addProfile("asr"));
elements.deleteAsrProfile.addEventListener("click", () => deleteProfile("asr"));
elements.asrProviderType.addEventListener("change", () => updateAsrCustomProviderType());
elements.llmProfileId.addEventListener("change", () => {
  saveProfileFields("llm", currentLlmProfileId);
  currentLlmProfileId = elements.llmProfileId.value;
  renderSelectedProfile("llm");
});
elements.addLlmProfile.addEventListener("click", () => addProfile("llm"));
elements.deleteLlmProfile.addEventListener("click", () => deleteProfile("llm"));
elements.llmModel.addEventListener("focus", () => refreshSelectedLlmModelList());
elements.llmProviderType.addEventListener("change", () => {
  elements.llmBaseUrl.placeholder = placeholderBaseUrl(elements.llmProviderType.value);
});

function resolveInitialLocale() {
  const stored = readStoredLocale();
  if (stored) {
    return stored;
  }
  return browserPrefersChinese() ? "zh" : "en";
}

function readStoredLocale() {
  try {
    const value = window.localStorage?.getItem(UI_LOCALE_STORAGE_KEY);
    return LOCALES.has(value) ? value : "";
  } catch {
    return "";
  }
}

function browserPrefersChinese() {
  const languages = [];
  if (Array.isArray(globalThis.navigator?.languages)) {
    languages.push(...globalThis.navigator.languages);
  }
  if (globalThis.navigator?.language) {
    languages.push(globalThis.navigator.language);
  }
  if (!languages.length) {
    return DEFAULT_LOCALE === "zh";
  }
  return languages.some(language => String(language || "").toLowerCase().startsWith("zh"));
}

function setLocale(locale) {
  const nextLocale = LOCALES.has(locale) ? locale : DEFAULT_LOCALE;
  if (currentLocale === nextLocale) {
    return;
  }
  currentLocale = nextLocale;
  try {
    window.localStorage?.setItem(UI_LOCALE_STORAGE_KEY, currentLocale);
  } catch {
    // Local storage may be unavailable in extension tests or privacy modes.
  }
  applyLocale();
}

function t(key, values = {}) {
  const dictionary = I18N[currentLocale] || I18N[DEFAULT_LOCALE];
  const fallback = I18N[DEFAULT_LOCALE] || {};
  const template = dictionary[key] ?? fallback[key] ?? key;
  return String(template).replace(/\{(\w+)\}/g, (_match, name) => (
    values[name] === undefined || values[name] === null ? "" : String(values[name])
  ));
}

function applyLocale() {
  const htmlLang = currentLocale === "zh" ? "zh-CN" : "en";
  if (document.documentElement) {
    document.documentElement.lang = htmlLang;
  }
  if ("title" in document) {
    document.title = t("documentTitle");
  }
  if (typeof document.querySelectorAll === "function") {
    document.querySelectorAll("[data-i18n]").forEach(element => {
      element.textContent = t(element.dataset.i18n);
    });
  }
  elements.localeEnglish.classList.toggle("active", currentLocale === "en");
  elements.localeChinese.classList.toggle("active", currentLocale === "zh");
  elements.localeEnglish.setAttribute("aria-pressed", String(currentLocale === "en"));
  elements.localeChinese.setAttribute("aria-pressed", String(currentLocale === "zh"));
  elements.localeSwitch.setAttribute("aria-label", t("languageLabel"));
  elements.tabsNav.setAttribute("aria-label", t("tabsLabel"));
  elements.localeEnglish.title = "English";
  elements.localeChinese.title = "中文";
  if (candidates.length || renderedCandidateSignature) {
    renderedCandidateSignature = "";
    renderCandidates(candidates);
  } else {
    elements.candidateSummary.textContent = t("readingSources");
  }
  renderSubtitleModeButton();
  renderSubtitleEditButton();
  renderSubtitleOverlayButton();
  updateActionButtons(currentJob);
  updateTaskPanelFocus(currentJob);
  renderSubtitleNotice();
  if (subtitleCues.length) {
    renderSubtitleCueList();
  }
  if (asrProfiles.length && elements.asrProfileId.value) {
    renderSelectedProfile("asr");
  }
  if (llmProfiles.length && elements.llmProfileId.value) {
    renderSelectedProfile("llm");
  }
}

async function init() {
  applyLocale();
  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await loadSettings();
  applyLocale();
  showTab(tabFromLocationHash());
  await activateCurrentPage();
  await refreshStatus();
  pollTimer = window.setInterval(refreshStatus, 1500);
}

function tabFromLocationHash() {
  return window.location.hash === "#settings" ? "settings" : "task";
}

async function refreshActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  const changed = Boolean(activeTab?.id && tab?.id && (tab.id !== activeTab.id || tab.url !== activeTab.url));
  if (tab?.id && (!activeTab?.id || changed)) {
    const previousTab = activeTab;
    if (changed && previousTab?.id && (subtitleCues.length || attachedSubtitleTabId === previousTab.id)) {
      await detachSubtitlesFromTab(previousTab.id);
    }
    activeTab = tab;
    if (changed) {
      currentJobId = "";
      currentJob = null;
      candidates = [];
      selectedCandidateKey = "";
      selectedCandidatePinned = false;
      renderedCandidateSignature = "";
      lastActivatedTabKey = "";
      clearedSubtitleJobIds.clear();
      clearSubtitles(t("subtitlePlaceholder"));
      renderEmptyJob(t("tabChangedReading"));
    }
  }
  return activeTab;
}

async function activateCurrentPage() {
  await refreshActiveTab();
  if (!activeTab?.id) {
    return;
  }
  const response = await send({ type: MESSAGE.ACTIVATE_PAGE, tabId: activeTab.id });
  if (!response.ok) {
    renderEmptyJob(response.error);
    return;
  }
  lastActivatedTabKey = activeTabKey(activeTab);
}

function activeTabKey(tab) {
  return tab?.id ? `${tab.id}:${tab.url || ""}` : "";
}

async function loadSettings() {
  const [syncStored, localStored] = await Promise.all([
    chrome.storage.sync.get([...LEGACY_MODEL_SYNC_KEYS, ...SUBTITLE_SYNC_KEYS]),
    chrome.storage.local.get(null)
  ]);
  const useStoredProfiles = localStored.modelSettingsVersion === MODEL_SETTINGS_VERSION;
  const subtitleSyncSettings = pickDefined(syncStored, SUBTITLE_SYNC_KEYS);
  asrProfiles = normalizeStoredProfiles("asr", useStoredProfiles ? localStored.asrProfiles : []);
  llmProfiles = normalizeStoredProfiles("llm", useStoredProfiles ? localStored.llmProfiles : []);
  const selectedAsrId = normalizeSelectedProfileId(
    asrProfiles,
    localStored.selectedAsrProfileId || DEFAULT_ASR_PROFILE_ID,
    DEFAULT_ASR_PROFILE_ID
  );
  const selectedLlmId = normalizeSelectedProfileId(
    llmProfiles,
    localStored.selectedLlmProfileId || DEFAULT_LLM_PROFILE_ID,
    DEFAULT_LLM_PROFILE_ID
  );
  renderProfileOptions(
    elements.asrProfileId,
    asrProfiles,
    selectedAsrId
  );
  renderProfileOptions(
    elements.llmProfileId,
    llmProfiles,
    selectedLlmId
  );
  currentAsrProfileId = elements.asrProfileId.value;
  currentLlmProfileId = elements.llmProfileId.value;
  applyStoredSettings({
    ...DEFAULTS,
    ...localStored,
    ...subtitleSyncSettings
  });
  renderSelectedProfile("asr");
  renderSelectedProfile("llm");
  await persistNormalizedModelProfilesIfNeeded(localStored, selectedAsrId, selectedLlmId);
  await clearLegacySyncSettingsIfNeeded(syncStored);
}

async function persistNormalizedModelProfilesIfNeeded(stored, selectedAsrId, selectedLlmId) {
  const nextAsrProfiles = profilesForStorage("asr", asrProfiles);
  const nextLlmProfiles = profilesForStorage("llm", llmProfiles);
  const needsMigration =
    stored.modelSettingsVersion !== MODEL_SETTINGS_VERSION ||
    stored.selectedAsrProfileId !== selectedAsrId ||
    stored.selectedLlmProfileId !== selectedLlmId ||
    !storagePayloadsEqual(stored.asrProfiles, nextAsrProfiles) ||
    !storagePayloadsEqual(stored.llmProfiles, nextLlmProfiles);
  if (!needsMigration) {
    return;
  }
  await chrome.storage.local.set({
    modelSettingsVersion: MODEL_SETTINGS_VERSION,
    selectedAsrProfileId: selectedAsrId,
    selectedLlmProfileId: selectedLlmId,
    asrProfiles: nextAsrProfiles,
    llmProfiles: nextLlmProfiles
  }).catch(() => {});
}

function storagePayloadsEqual(left, right) {
  return JSON.stringify(left || []) === JSON.stringify(right || []);
}

function applyStoredSettings(data) {
  setSourceLanguageValue(data.sourceLanguage || DEFAULTS.sourceLanguage);
  setTargetLanguageValue(data.targetLanguage || DEFAULTS.targetLanguage);
  setWebFfmpegPerformanceValue(data.webFfmpegPerformance || DEFAULTS.webFfmpegPerformance);
  elements.translationWorkers.value = valueOrDefault(data.translationWorkers, DEFAULTS.translationWorkers);
  elements.chunkMinutes.value = valueOrDefault(data.chunkMinutes, DEFAULTS.chunkMinutes);
  elements.subtitleFontSize.value = valueOrDefault(data.subtitleFontSize, DEFAULTS.subtitleFontSize);
  elements.subtitleBackgroundOpacity.value = valueOrDefault(data.subtitleBackgroundOpacity, DEFAULTS.subtitleBackgroundOpacity);
  subtitleOverlayEnabled = data.subtitleOverlayEnabled !== false;
  subtitleDisplayMode = normalizeSubtitleDisplayMode(data.subtitleDisplayMode || DEFAULTS.subtitleDisplayMode);
  renderSubtitleModeButton();
  renderSubtitleEditButton();
  renderSubtitleOverlayButton();
}

function setTargetLanguageValue(value) {
  elements.targetLanguage.value = normalizeTargetLanguageValue(value, DEFAULTS.targetLanguage);
}

function getTargetLanguageValue() {
  return normalizeTargetLanguageValue(elements.targetLanguage.value, DEFAULTS.targetLanguage);
}

function normalizeWebFfmpegPerformanceValue(value, fallback = DEFAULTS.webFfmpegPerformance) {
  return ["auto", "stable", "fast"].includes(value) ? value : fallback;
}

function setWebFfmpegPerformanceValue(value) {
  elements.webFfmpegPerformance.value = normalizeWebFfmpegPerformanceValue(value);
}

function getWebFfmpegPerformanceValue() {
  return normalizeWebFfmpegPerformanceValue(elements.webFfmpegPerformance.value);
}

function setSourceLanguageValue(value) {
  elements.sourceLanguage.value = normalizeSourceLanguageValue(value, DEFAULTS.sourceLanguage);
}

function getSourceLanguageValue() {
  return normalizeSourceLanguageValue(elements.sourceLanguage.value, DEFAULTS.sourceLanguage);
}

async function clearLegacySyncSettingsIfNeeded(syncStored) {
  if (!LEGACY_MODEL_SYNC_KEYS.some(key => syncStored[key] !== undefined && syncStored[key] !== "")) {
    return;
  }
  await chrome.storage.sync.remove(LEGACY_MODEL_SYNC_KEYS).catch(() => {});
}

function pickDefined(source, keys) {
  const result = {};
  for (const key of keys) {
    if (source?.[key] !== undefined) {
      result[key] = source[key];
    }
  }
  return result;
}

function renderProfileOptions(select, profiles, selectedId) {
  select.replaceChildren();
  for (const profile of profiles) {
    const option = document.createElement("option");
    option.value = profile.id;
    option.textContent = profile.name || profile.model || t("unnamedProfile");
    select.appendChild(option);
  }
  select.value = profiles.some(profile => profile.id === selectedId) ? selectedId : profiles[0]?.id || "";
}

function selectedProfile(kind) {
  const profiles = kind === "asr" ? asrProfiles : llmProfiles;
  const selectedId = kind === "asr" ? elements.asrProfileId.value : elements.llmProfileId.value;
  return profileById(profiles, selectedId);
}

function updateAsrVadFilterAvailability() {
  const select = elements.asrVadFilter;
  if (!select) {
    return;
  }
  const options = Array.from(select.options || select.children || []);
  for (const option of options) {
    if (option.value === "off") {
      option.textContent = t("off");
    }
    option.hidden = false;
  }
  select.disabled = false;
}

function updateAsrProviderTypeOptions(profile) {
  const select = elements.asrProviderType;
  if (!select) {
    return;
  }
  const allowFunAsr = profile?.providerType === "dashscope_funasr";
  for (const option of Array.from(select.options || select.children || [])) {
    if (option.value !== "dashscope_funasr") {
      continue;
    }
    option.hidden = !allowFunAsr;
    option.disabled = !allowFunAsr;
  }
}

function isBuiltInAsrTemplate(profile) {
  return new Set(["openai_whisper", "groq_whisper", "xai_grok", "dashscope_funasr"]).has(profile?.id);
}

function isLockedAsrProviderType(profile) {
  return isBuiltInAsrTemplate(profile) || ["groq", "xai"].includes(profile?.providerType);
}

function shouldHideAsrProviderType(profile) {
  return true;
}

function defaultLlmTemplateById(id) {
  return FuguangSidepanelProfiles.KNOWN_LLM_PROFILES.find(profile => profile.id === id) || null;
}

function defaultAsrTemplateById(id) {
  return FuguangSidepanelProfiles.KNOWN_ASR_PROFILES.find(profile => profile.id === id) || null;
}

function apiKeyUrlForProfile(kind, profile) {
  const asrUrls = {
    openai_whisper: "https://platform.openai.com/api-keys",
    groq_whisper: "https://console.groq.com/keys",
    xai_grok: "https://console.x.ai/",
    dashscope_funasr: "https://bailian.console.aliyun.com/?tab=model#/api-key"
  };
  const llmUrls = {
    siliconflow_llm: "https://cloud.siliconflow.cn/i/My0p5Jgs",
    bailian_llm: "https://bailian.console.aliyun.com/?tab=model#/model-market",
    volcengine_llm: "https://console.volcengine.com/ark/region:ark+cn-beijing/model",
    openrouter_llm: "https://openrouter.ai/models"
  };
  return (kind === "asr" ? asrUrls : llmUrls)[profile?.id] || "";
}

function updateApiKeyHelpLink(kind, profile) {
  const link = kind === "asr" ? elements.asrApiKeyHelpLink : elements.llmApiKeyHelpLink;
  if (!link) {
    return;
  }
  const url = apiKeyUrlForProfile(kind, profile);
  link.hidden = !url;
  if (url) {
    link.href = url;
  } else {
    link.removeAttribute("href");
  }
}

function llmModelListEndpoint(profile) {
  if (!profile) {
    return null;
  }
  if (profile.id === "openrouter_llm") {
    return { url: "https://openrouter.ai/api/v1/models", requiresKey: false };
  }
  if (["siliconflow_llm", "bailian_llm", "volcengine_llm"].includes(profile.id)) {
    const baseUrl = String(profile.baseUrl || "").trim();
    if (!baseUrl) {
      return null;
    }
    return { url: `${baseUrl.replace(/\/+$/, "")}/models`, requiresKey: true };
  }
  return null;
}

function setLlmModelHint(text = "") {
  if (!elements.llmModelHint) {
    return;
  }
  elements.llmModelHint.textContent = text;
  elements.llmModelHint.hidden = !text;
}

function renderLlmModelSelect(models, currentModel = "") {
  const select = elements.llmModelSelect;
  if (!select) {
    return;
  }
  if (!models.length) {
    select.replaceChildren();
    select.hidden = true;
    return;
  }
  const values = [...new Set(models.map(value => String(value || "").trim()).filter(Boolean))];
  if (!values.length) {
    select.replaceChildren();
    select.hidden = true;
    return;
  }
  const options = values.map(model => {
    const option = document.createElement("option");
    option.value = model;
    option.textContent = model;
    return option;
  });
  select.replaceChildren(...options);
  select.value = values.includes(currentModel) ? currentModel : values[0];
  select.hidden = false;
}

function parseModelListResponse(payload) {
  const items = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : [];
  return [...new Set(items.map(item => {
    if (typeof item === "string") {
      return item;
    }
    return item?.id || item?.model || item?.name || "";
  }).map(value => String(value || "").trim()).filter(Boolean))];
}

async function refreshSelectedLlmModelList() {
  saveProfileFields("llm", elements.llmProfileId.value);
  const profile = selectedProfile("llm");
  const endpoint = llmModelListEndpoint(profile);
  if (!endpoint) {
    renderLlmModelSelect([], elements.llmModel.value.trim());
    setLlmModelHint(isBuiltInLlmProfile(profile) ? t("modelListUnavailable") : "");
    return;
  }
  const apiKey = elements.llmApiKey.value.trim();
  if (endpoint.requiresKey && !apiKey) {
    renderLlmModelSelect([], elements.llmModel.value.trim());
    setLlmModelHint(t("modelListNeedsKey"));
    return;
  }
  const requestId = ++llmModelListRequestId;
  setLlmModelHint(t("modelListLoading"));
  try {
    const headers = endpoint.requiresKey ? { Authorization: `Bearer ${apiKey}` } : {};
    const response = await fetch(endpoint.url, { headers });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const models = parseModelListResponse(await response.json());
    if (requestId !== llmModelListRequestId) {
      return;
    }
    renderLlmModelSelect(models, elements.llmModel.value.trim());
    setLlmModelHint(models.length ? t("modelListLoaded", { count: models.length }) : t("modelListUnavailable"));
  } catch (error) {
    if (requestId !== llmModelListRequestId) {
      return;
    }
    renderLlmModelSelect([], elements.llmModel.value.trim());
    setLlmModelHint(t("modelListFetchFailed", { error: formatRuntimeError(error.message) }));
  }
}

function setFieldHidden(field, hidden) {
  if (!field) {
    return;
  }
  field.hidden = hidden;
  field.style.display = hidden ? "none" : "";
  field.setAttribute("aria-hidden", String(Boolean(hidden)));
}

function updateAsrCustomProviderType() {
  const profile = selectedProfile("asr");
  if (isLockedAsrProviderType(profile)) {
    renderSelectedProfile("asr");
    return;
  }
  const providerType = normalizeCustomProfileProviderType("asr", elements.asrProviderType.value);
  profile.providerType = providerType;
  const currentName = elements.asrProfileName.value.trim();
  if (!currentName || currentName === "自定义 ASR" || currentName === "未命名档案" || currentName === "Untitled profile") {
    profile.name = defaultCustomProfileName("asr", providerType);
  } else {
    profile.name = currentName;
  }
  profile.model = elements.asrModel.value.trim() || (providerType === "dashscope_funasr" ? "fun-asr" : "");
  profile.vadFilter = providerType === "dashscope_funasr" ? "off" : normalizeAsrVadFilterMode(elements.asrVadFilter.value);
  renderProfileOptions(elements.asrProfileId, asrProfiles, profile.id);
  renderSelectedProfile("asr");
}

function renderSelectedProfile(kind) {
  const profile = selectedProfile(kind);
  if (kind === "asr") {
    const usesXaiAsr = profile.id === "xai_grok" || profile.providerType === "xai";
    const usesFunAsr = profile.providerType === "dashscope_funasr";
    const builtInTemplate = isBuiltInAsrTemplate(profile);
    setFieldHidden(elements.asrProviderTypeField, shouldHideAsrProviderType(profile));
    if (elements.asrProviderType) {
      updateAsrProviderTypeOptions(profile);
      elements.asrProviderType.value = usesFunAsr ? "dashscope_funasr" : normalizeCustomProfileProviderType("asr", profile.providerType);
      elements.asrProviderType.disabled = builtInTemplate;
    }
    elements.asrProfileName.value = profile.name || "";
    elements.asrBaseUrl.value = profile.baseUrl || "";
    elements.asrModel.value = profile.model || "";
    elements.asrVadFilter.value = normalizeAsrVadFilterMode(profile.vadFilter);
    elements.asrApiKey.value = profile.apiKey || "";
    updateApiKeyHelpLink("asr", profile);
    elements.asrBaseUrl.disabled = false;
    elements.asrApiKey.disabled = false;
    setFieldHidden(elements.asrModelField, usesXaiAsr);
    setFieldHidden(elements.asrVadFilterField, usesXaiAsr);
    elements.asrModel.disabled = usesXaiAsr;
    updateAsrVadFilterAvailability();
    if (elements.funAsrLongFileHint) {
      elements.funAsrLongFileHint.hidden = !usesFunAsr;
    }
    elements.asrBaseUrl.placeholder = placeholderBaseUrl(profile.providerType);
    elements.asrModel.placeholder = "";
    elements.asrApiKey.placeholder = t("localOnlyPlaceholder");
    elements.asrApiKeyHint.textContent = t("asrKeyHint");
    elements.deleteAsrProfile.disabled = builtInTemplate;
    return;
  }
  const builtInLlmTemplate = isBuiltInLlmProfile(profile);
  elements.llmProviderType.value = ["openai", "anthropic"].includes(profile.providerType) ? profile.providerType : "openai";
  elements.llmProfileName.value = profile.name || "";
  elements.llmBaseUrl.value = profile.baseUrl || "";
  elements.llmModel.value = profile.model || "";
  renderLlmModelSelect([], profile.model || "");
  setLlmModelHint("");
  elements.llmApiKey.value = profile.apiKey || "";
  updateApiKeyHelpLink("llm", profile);
  elements.llmProfileName.disabled = builtInLlmTemplate;
  elements.llmProviderType.disabled = builtInLlmTemplate;
  elements.deleteLlmProfile.disabled = builtInLlmTemplate;
  elements.llmBaseUrl.disabled = false;
  elements.llmModel.disabled = false;
  elements.llmApiKey.disabled = false;
  elements.llmBaseUrl.placeholder = placeholderBaseUrl(elements.llmProviderType.value);
  elements.llmModel.placeholder = t("modelNamePlaceholder");
  elements.llmApiKey.placeholder = t("localOnlyPlaceholder");
  elements.llmApiKeyHint.textContent = t("llmKeyHint");
}

function saveProfileFields(kind, profileId) {
  if (kind === "asr") {
    const profile = profileById(asrProfiles, profileId || elements.asrProfileId.value);
    if (isBuiltInAsrTemplate(profile)) {
      const template = defaultAsrTemplateById(profile.id) || profile;
      profile.name = template.name || profile.name || "";
      profile.providerType = template.providerType || "openai";
      profile.baseUrl = template.baseUrl || "";
      profile.model = template.model || "";
      profile.vadFilter = template.vadFilter || "auto";
      profile.apiKey = elements.asrApiKey.value.trim();
      return;
    }
    if (!isLockedAsrProviderType(profile)) {
      profile.providerType = normalizeCustomProfileProviderType("asr", elements.asrProviderType.value || profile.providerType);
    }
    profile.name = elements.asrProfileName.value.trim() || profile.name || profile.model || defaultCustomProfileName("asr", profile.providerType);
    profile.baseUrl = elements.asrBaseUrl.value.trim();
    profile.model = elements.asrModel.value.trim();
    profile.vadFilter = profile.providerType === "dashscope_funasr" ? "off" : normalizeAsrVadFilterMode(elements.asrVadFilter.value);
    profile.apiKey = elements.asrApiKey.value.trim();
    return;
  }
  const profile = profileById(llmProfiles, profileId || elements.llmProfileId.value);
  if (isBuiltInLlmProfile(profile)) {
    const template = defaultLlmTemplateById(profile.id) || profile;
    profile.name = template.name || profile.name || "";
    profile.providerType = template.providerType || "openai";
    profile.baseUrl = elements.llmBaseUrl.value.trim() || template.baseUrl || "";
    profile.model = elements.llmModel.value.trim() || template.model || "";
    profile.apiKey = elements.llmApiKey.value.trim();
    return;
  }
  profile.name = elements.llmProfileName.value.trim() || profile.name || profile.model || t("unnamedProfile");
  profile.providerType = elements.llmProviderType.value.trim() || "openai";
  profile.baseUrl = elements.llmBaseUrl.value.trim();
  profile.model = elements.llmModel.value.trim();
  profile.apiKey = elements.llmApiKey.value.trim();
}

function addProfile(kind) {
  saveProfileFields(kind, kind === "asr" ? currentAsrProfileId : currentLlmProfileId);
  const profile = createEmptyProfile(kind);
  const profiles = kind === "asr" ? asrProfiles : llmProfiles;
  profiles.push(profile);
  const select = kind === "asr" ? elements.asrProfileId : elements.llmProfileId;
  renderProfileOptions(select, profiles, profile.id);
  if (kind === "asr") {
    currentAsrProfileId = profile.id;
  } else {
    currentLlmProfileId = profile.id;
  }
  renderSelectedProfile(kind);
  setSettingsMessage(t("profileAdded"));
}

function deleteProfile(kind) {
  const profiles = kind === "asr" ? asrProfiles : llmProfiles;
  const select = kind === "asr" ? elements.asrProfileId : elements.llmProfileId;
  const selectedId = select.value;
  const index = profiles.findIndex(profile => profile.id === selectedId);
  if (
    (kind === "asr" && isBuiltInAsrTemplate(profiles[index])) ||
    (kind === "llm" && isBuiltInLlmProfile(profiles[index]))
  ) {
    renderSelectedProfile(kind);
    setSettingsMessage(t("profileDeleted"));
    return;
  }
  if (index >= 0) {
    profiles.splice(index, 1);
  }
  if (!profiles.length) {
    profiles.push(...defaultProfiles(kind));
  }
  renderProfileOptions(select, profiles, profiles[Math.max(0, index - 1)]?.id || profiles[0]?.id || "");
  if (kind === "asr") {
    currentAsrProfileId = select.value;
  } else {
    currentLlmProfileId = select.value;
  }
  renderSelectedProfile(kind);
  setSettingsMessage(t("profileDeleted"));
}

async function saveSettings() {
  const selectedAsrProfileId = elements.asrProfileId.value || DEFAULT_ASR_PROFILE_ID;
  const selectedLlmProfileId = elements.llmProfileId.value || DEFAULT_LLM_PROFILE_ID;
  saveProfileFields("asr", selectedAsrProfileId);
  saveProfileFields("llm", selectedLlmProfileId);
  renderProfileOptions(elements.asrProfileId, asrProfiles, selectedAsrProfileId);
  renderProfileOptions(elements.llmProfileId, llmProfiles, selectedLlmProfileId);
  currentAsrProfileId = elements.asrProfileId.value;
  currentLlmProfileId = elements.llmProfileId.value;
  await chrome.storage.sync.set({
    subtitleFontSize: clampSetting(elements.subtitleFontSize.value, 18, 48, DEFAULTS.subtitleFontSize),
    subtitleOverlayEnabled,
    subtitleDisplayMode,
    subtitleBackgroundOpacity: clampSetting(
      elements.subtitleBackgroundOpacity.value,
      0,
      95,
      DEFAULTS.subtitleBackgroundOpacity
    )
  });
  await chrome.storage.local.set({
    modelSettingsVersion: MODEL_SETTINGS_VERSION,
    selectedAsrProfileId: currentAsrProfileId || DEFAULT_ASR_PROFILE_ID,
    selectedLlmProfileId: currentLlmProfileId || DEFAULT_LLM_PROFILE_ID,
    asrProfiles: profilesForStorage("asr", asrProfiles),
    llmProfiles: profilesForStorage("llm", llmProfiles),
    sourceLanguage: getSourceLanguageValue(),
    targetLanguage: getTargetLanguageValue(),
    webFfmpegPerformance: getWebFfmpegPerformanceValue(),
    translationWorkers: clampSetting(elements.translationWorkers.value, 1, 6, DEFAULTS.translationWorkers),
    chunkMinutes: Math.round(clampSetting(elements.chunkMinutes.value, 1, 60, DEFAULTS.chunkMinutes))
  });
  await chrome.storage.local.remove(["asrApiKey", "llmApiKey", "asrBaseUrl", "asrModel", "llmBaseUrl", "llmModel", "llmProviderType", "asrWorkers"]).catch(() => {});
  setSettingsMessage(t("settingsSaved"));
}

async function saveSourceLanguageSetting() {
  await chrome.storage.local.set({
    sourceLanguage: getSourceLanguageValue()
  }).catch(() => {});
}

async function refreshStatus() {
  if (refreshStatusInFlight) {
    return;
  }
  refreshStatusInFlight = true;
  try {
  await refreshActiveTab();
  if (!activeTab?.id) {
    renderEmptyJob(t("noTab"));
    return;
  }
  if (activeTabKey(activeTab) !== lastActivatedTabKey) {
    await activateCurrentPage();
  }
  const response = await send({ type: MESSAGE.GET_STATUS, tabId: activeTab.id });
  if (!response.ok) {
    renderEmptyJob(response.error);
    return;
  }
  elements.status.textContent = statusLabel(response);
  candidates = response.candidates || [];
  ensureSelection();
  renderCandidates(candidates);
  const job = response.preloadJob;
  const jobId = job?.id || currentJobId;
  if (jobId) {
    currentJobId = jobId;
    const jobResponse = await send({ type: MESSAGE.CHECK_PRELOAD_JOB, jobId, tabId: activeTab.id });
    if (jobResponse.ok) {
      if (jobResponse.missing || !jobResponse.job) {
        currentJobId = "";
        clearSubtitles(t("subtitlePlaceholder"));
        renderEmptyJob(t("oldJobMissing"));
        await tryLoadCachedSubtitleForCurrentPage();
        return;
      }
      elements.status.textContent = statusLabel({
        ...response,
        preload: jobResponse.job.status || response.preload,
        preloadJob: jobResponse.job
      });
      renderJob(jobResponse.job);
      if (
        jobResponse.job?.translation?.vttPath &&
        Number(jobResponse.job?.translation?.segmentCount || 0) > 0 &&
        !jobResponse.job?.subtitleCleared &&
        !isSubtitleJobCleared(jobId)
      ) {
        await renderSubtitles(jobId, jobResponse.job);
      }
      return;
    }
    setMessage(jobResponse.error || t("backendNoResponse", { error: "" }));
    currentJobId = "";
    renderEmptyJob(jobResponse.error || t("backendNoResponse", { error: t("unknownError") }));
    await tryLoadCachedSubtitleForCurrentPage();
    return;
  }
  renderEmptyJob(t("noTrackedPreloadJob"));
  await tryLoadCachedSubtitleForCurrentPage();
  } finally {
    refreshStatusInFlight = false;
  }
}

async function startPreloadFromSidePanel() {
  if (startRequestInFlight) {
    return;
  }
  startRequestInFlight = true;
  updateActionButtons(currentJob);
  try {
    await refreshActiveTab();
    const requestContext = captureSidepanelRequestContext();
    if (!requestContext.tabId) {
      setMessage(t("noTab"));
      return;
    }
    const initialSelected = getSelectedCandidate();
    let preparedLocalCandidate = null;
    if (isLocalFileCandidate(initialSelected)) {
      preparedLocalCandidate = await prepareLocalMediaCandidateForStart(toPreloadCandidate(initialSelected));
      if (!(await sidepanelRequestStillCurrent(requestContext))) {
        setMessage(t("tabChangedCancel"));
        return;
      }
    }
    if (!preparedLocalCandidate) {
      candidates = [];
      renderedCandidateSignature = "";
      renderCandidates(candidates);
      const refreshed = await refreshCandidates({ silent: true });
      if (!refreshed) {
        return;
      }
      if (!(await sidepanelRequestStillCurrent(requestContext))) {
        setMessage(t("tabChangedCancel"));
        return;
      }
    }
    const selected = getSelectedCandidate();
    if (!selected) {
      setMessage(t("noCandidates"));
      return;
    }
    await saveSourceLanguageSetting();
    setMessage(t("submittingSource"));
    if (!(await sidepanelRequestStillCurrent(requestContext))) {
      setMessage(t("tabChangedCancel"));
      return;
    }
    let candidate = mergePreparedLocalMediaCandidate(
      toPreloadCandidate(selected),
      preparedLocalCandidate
    );
    if (isLocalFileCandidate(candidate) && !candidate.localMediaFileKey) {
      candidate = await prepareLocalMediaCandidateForStart(candidate);
      if (!(await sidepanelRequestStillCurrent(requestContext))) {
        setMessage(t("tabChangedCancel"));
        return;
      }
    }
    const response = await send({
      type: MESSAGE.START_PRELOAD_AUTO,
      tabId: requestContext.tabId,
      candidate
    });
    if (!response.ok) {
      setMessage(response.error);
      return;
    }
    if (!response.job?.id) {
      setMessage(response.message || t("startFailedNoJob"));
      await refreshStatus();
      return;
    }
    if (!(await sidepanelRequestStillCurrent(requestContext))) {
      setMessage(t("tabChangedIgnore"));
      return;
    }
    currentJobId = response.job.id;
    clearedSubtitleJobIds.clear();
    clearSubtitles(t("waitingNewSubtitles"), currentJobId);
    setMessage(t("taskSubmitted"));
    renderJob(response.job);
  } finally {
    startRequestInFlight = false;
    updateActionButtons(currentJob);
  }
}

function isLocalFileCandidate(candidate = {}) {
  return isLocalFileUrl(candidate?.url || candidate?.sourceUrl || "");
}

function isLocalFileUrl(rawUrl = "") {
  try {
    return new URL(String(rawUrl || "")).protocol === "file:";
  } catch {
    return false;
  }
}

async function prepareLocalMediaCandidateForStart(candidate = {}) {
  if (!isLocalFileCandidate(candidate)) {
    return candidate;
  }
  const files = globalThis.FuguangLocalMediaFiles;
  if (!files?.pickLocalMediaFileForSource) {
    throw new Error("当前 Chrome 不支持本地文件授权，无法稳定读取本地 file:// 视频。");
  }
  const expectedName = files.localMediaFileNameFromUrl?.(candidate.url) ||
    candidate.fileName ||
    candidate.filename ||
    candidate.title ||
    t("unnamedMedia");
  setMessage(t("localMediaPermissionPrompt", { name: expectedName }));
  const fileRef = await files.pickLocalMediaFileForSource(candidate.url);
  setMessage(t("localMediaPermissionReady", { name: fileRef.name || expectedName }));
  return {
    ...candidate,
    localMediaFileKey: fileRef.key,
    localMediaFileName: fileRef.name || expectedName,
    localMediaFileSize: fileRef.size || 0,
    localMediaFileLastModified: fileRef.lastModified || 0
  };
}

function mergePreparedLocalMediaCandidate(candidate = {}, prepared = null) {
  if (!prepared?.localMediaFileKey || !isLocalFileCandidate(candidate)) {
    return candidate;
  }
  if (String(candidate.url || "") !== String(prepared.url || "")) {
    return candidate;
  }
  return {
    ...candidate,
    localMediaFileKey: prepared.localMediaFileKey,
    localMediaFileName: prepared.localMediaFileName,
    localMediaFileSize: prepared.localMediaFileSize,
    localMediaFileLastModified: prepared.localMediaFileLastModified
  };
}

async function refreshCandidates(options = {}) {
  await refreshActiveTab();
  if (!activeTab?.id) {
    setMessage(t("noTab"));
    return false;
  }
  if (!options.skipActivate) {
    await activateCurrentPage();
  }
  const response = await send({ type: MESSAGE.GET_CANDIDATES, tabId: activeTab.id });
  if (!response.ok) {
    setMessage(response.error);
    return false;
  }
  candidates = response.candidates || [];
  ensureSelection();
  renderCandidates(candidates);
  if (!options.silent) {
    setMessage(candidates.length ? t("sourcesRefreshed", { count: candidates.length }) : "");
  }
  return true;
}

async function retryPreloadFromSidePanel() {
  if (retryRequestInFlight) {
    return;
  }
  await refreshActiveTab();
  const requestContext = captureSidepanelRequestContext();
  retryRequestInFlight = true;
  updateActionButtons(currentJob);
  setMessage(retryPreloadMessage(currentJob));
  try {
    const response = await send({
      type: MESSAGE.RETRY_PRELOAD,
      tabId: requestContext.tabId
    });
    if (!response.ok) {
      setMessage(response.error);
      return;
    }
    if (!(await sidepanelRequestStillCurrent(requestContext))) {
      setMessage(t("tabChangedIgnore"));
      return;
    }
    currentJobId = response.job?.id || "";
    if (currentJobId) {
      clearedSubtitleJobIds.delete(currentJobId);
    }
    setMessage(response.message || t("retrySubmitted"));
    renderJob(response.job);
  } finally {
    retryRequestInFlight = false;
    updateActionButtons(currentJob);
  }
}

function retryPreloadMessage(job) {
  const retryableAsrFailures = countRetryableAsrFailureChunks(job);
  if (retryableAsrFailures > 0) {
    return t("retryPreloadMessage");
  }
  if (countReusableSourceChunks(job) > 0) {
    return t("reuseSourceMessage");
  }
  if (countReusableAudioChunks(job) > 0) {
    return t("reuseAudioMessage");
  }
  return t("continueTaskMessage");
}

async function rerunAsrFromSidePanel(chunkIndexes = []) {
  if (asrRetryRequestInFlight) {
    return;
  }
  await refreshActiveTab();
  const requestContext = captureSidepanelRequestContext();
  asrRetryRequestInFlight = true;
  updateActionButtons(currentJob);
  setMessage(t("rerunAsrMessage"));
  if (!chunkIndexes.length) {
    clearSubtitles(t("waitingNewSubtitles"), currentJobId);
  }
  try {
    const response = await send({
      type: MESSAGE.RERUN_ASR_PRELOAD,
      tabId: requestContext.tabId,
      chunkIndexes: Array.isArray(chunkIndexes) ? chunkIndexes : [],
      sourceLanguage: getSourceLanguageValue(),
      targetLanguage: getTargetLanguageValue()
    });
    if (!response.ok) {
      setMessage(response.error);
      return;
    }
    if (!(await sidepanelRequestStillCurrent(requestContext))) {
      setMessage(t("tabChangedIgnore"));
      return;
    }
    currentJobId = response.job?.id || currentJobId;
    if (currentJobId) {
      clearedSubtitleJobIds.delete(currentJobId);
    }
    setMessage(response.message || t("rerunAsrSubmitted"));
    renderJob(response.job);
  } finally {
    asrRetryRequestInFlight = false;
    updateActionButtons(currentJob);
  }
}

async function retryTranslationFromSidePanel(chunkIndexes = []) {
  if (translationRetryRequestInFlight) {
    return;
  }
  await refreshActiveTab();
  if (!currentJobId && currentTranscriptHasReusableSource()) {
    await retranslateCachedTranscriptFromSidePanel();
    return;
  }
  const requestContext = captureSidepanelRequestContext();
  translationRetryRequestInFlight = true;
  updateActionButtons(currentJob);
  setMessage(t("retranslateOnlyMessage"));
  if (!chunkIndexes.length) {
    clearSubtitles(t("waitingNewSubtitles"), currentJobId);
  }
  try {
    const response = await send({
      type: MESSAGE.RETRANSLATE_PRELOAD,
      tabId: requestContext.tabId,
      chunkIndexes: Array.isArray(chunkIndexes) ? chunkIndexes : [],
      targetLanguage: getTargetLanguageValue()
    });
    if (!response.ok) {
      setMessage(response.error);
      return;
    }
    if (!(await sidepanelRequestStillCurrent(requestContext))) {
      setMessage(t("tabChangedIgnore"));
      return;
    }
    currentJobId = response.job?.id || currentJobId;
    if (currentJobId) {
      clearedSubtitleJobIds.delete(currentJobId);
    }
    setMessage(response.message || t("retranslateSubmitted"));
    renderJob(response.job);
  } finally {
    translationRetryRequestInFlight = false;
    updateActionButtons(currentJob);
  }
}

async function retranslateCachedTranscriptFromSidePanel() {
  const requestContext = captureSidepanelRequestContext();
  translationRetryRequestInFlight = true;
  updateActionButtons(currentJob);
  setMessage(t("retranslateCacheMessage"));
  try {
    const response = await send({
      type: MESSAGE.RETRANSLATE_TRANSCRIPT,
      tabId: requestContext.tabId,
      transcript: currentTranscript,
      metadata: cachedTranscriptRetranslateMetadata(),
      targetLanguage: getTargetLanguageValue()
    });
    if (!response.ok) {
      setMessage(response.error);
      return;
    }
    if (!(await sidepanelRequestStillCurrent(requestContext))) {
      setMessage(t("tabChangedIgnore"));
      return;
    }
    currentJobId = response.job?.id || currentJobId;
    if (currentJobId) {
      clearedSubtitleJobIds.delete(currentJobId);
    }
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    setMessage(response.message || t("retranslateSubmitted"));
    renderJob(response.job);
  } finally {
    translationRetryRequestInFlight = false;
    updateActionButtons(currentJob);
  }
}

function cachedTranscriptRetranslateMetadata() {
  const metadata = currentTranscript?.metadata && typeof currentTranscript.metadata === "object" ? currentTranscript.metadata : {};
  const selected = getSelectedCandidate();
  return {
    ...metadata,
    title: currentPageTitleFallback(metadata),
    pageUrl: currentSubtitleCacheEntry?.pageUrl || metadata.pageUrl || activeTab?.url || selected?.pageUrl || "",
    sourceUrl: currentSubtitleCacheEntry?.sourceUrl || metadata.sourceUrl || selected?.url || ""
  };
}

function currentPageTitleFallback(metadata = {}) {
  const selected = getSelectedCandidate();
  return currentSubtitleCacheEntry?.title || metadata.title || selected?.title || activeTab?.title || "";
}

function currentTranscriptHasReusableSource() {
  return transcriptReusableSourceCount(currentTranscript) > 0;
}

function transcriptReusableSourceCount(transcript) {
  const source = Array.isArray(transcript?.source) ? transcript.source : [];
  return source.filter(segment => cleanSubtitleText(segment?.text || "")).length;
}

async function retryChunkFromSidePanel(index, options = {}) {
  await refreshActiveTab();
  if (!currentJobId || !Number.isFinite(index)) {
    setMessage(t("noTrackedJob"));
    return;
  }
  const requestContext = captureSidepanelRequestContext();
  if (retryingChunks.has(index)) {
    return;
  }
  retryingChunks.add(index);
  updateActionButtons(currentJob);
  setMessage(options.translationOnly ? t("retranslateChunkMessage", { index: index + 1 }) : t("retryChunkMessage", { index: index + 1 }));
  try {
    const response = await send({
      type: options.translationOnly ? MESSAGE.RETRANSLATE_PRELOAD : MESSAGE.RETRY_PRELOAD_CHUNKS,
      tabId: requestContext.tabId,
      chunkIndexes: [index],
      ...(options.translationOnly ? { targetLanguage: getTargetLanguageValue() } : {})
    });
    if (!response.ok) {
      setMessage(response.error);
      return;
    }
    if (!(await sidepanelRequestStillCurrent(requestContext))) {
      setMessage(t("tabChangedIgnore"));
      return;
    }
    if (currentJobId) {
      clearedSubtitleJobIds.delete(currentJobId);
    }
    setMessage(response.message || (options.translationOnly ? t("retranslateChunkSubmitted", { index: index + 1 }) : t("retryChunkSubmitted", { index: index + 1 })));
    renderJob(response.job);
  } finally {
    retryingChunks.delete(index);
    updateActionButtons(currentJob);
  }
}

function captureSidepanelRequestContext() {
  return {
    tabId: activeTab?.id || 0,
    tabKey: activeTabKey(activeTab),
    jobId: currentJobId || ""
  };
}

async function sidepanelRequestStillCurrent(requestContext) {
  await refreshActiveTab();
  return sidepanelRequestContextStillCurrent(requestContext);
}

function sidepanelRequestContextStillCurrent(requestContext) {
  return Boolean(
    requestContext?.tabId &&
    requestContext.tabKey &&
    activeTabKey(activeTab) === requestContext.tabKey &&
    (currentJobId || "") === (requestContext.jobId || "")
  );
}

async function cancelPreloadFromSidePanel() {
  await refreshActiveTab();
  if (!currentJobId) {
    setMessage(t("noTrackedJob"));
    return;
  }
  setMessage(t("stoppingTask"));
  const response = await send({ type: MESSAGE.CANCEL_PRELOAD, tabId: activeTab?.id, jobId: currentJobId });
  if (!response.ok) {
    setMessage(response.error);
    return;
  }
  setMessage(t("stoppedTask"));
  renderJob(response.job);
}

async function clearCurrentAudioCache() {
  await refreshActiveTab();
  if (!currentJobId) {
    setMessage(t("noAudioCacheTask"));
    return;
  }
  const running = isRunningJob(currentJob);
  if (running) {
    setMessage(t("runningNoClearAudio"));
    return;
  }
  setMessage(t("clearingAudio"));
  const response = await send({
    type: MESSAGE.CLEAR_PRELOAD_AUDIO_CACHE,
    tabId: activeTab?.id,
    jobId: currentJobId
  });
  if (!response.ok) {
    setMessage(response.error);
    return;
  }
  setMessage(response.message || t("audioCleared"));
  renderJob(response.job);
}

function renderJob(job) {
  if (!job) {
    renderEmptyJob(t("backendNoJob"));
    return;
  }
  currentJob = job || null;
  elements.jobStatus.replaceChildren();
  if (job?.id) {
    if (currentJobId && currentJobId !== job.id) {
      taskDetailsExpanded = false;
      taskDetailsManuallyCollapsed = false;
      renderedSubtitleSignature = "";
      manualSubtitleOverride = null;
      activeCueIndex = -1;
      currentTranscript = null;
      currentSubtitleCacheEntry = null;
    }
    currentJobId = job.id;
  }
  if (job?.id && renderedSubtitleJobId && renderedSubtitleJobId !== job.id) {
    clearSubtitles(t("waitingNewSubtitles"), job.id);
  }
  const progress = job.progress || {};
  const extraction = progress.extraction || job.extract || progress;
  const translation = progress.translation || job.translation || {};
  const funAsrJob = isFunAsrJob(job);
  elements.status.textContent = statusLabel({ preload: job.status, preloadJob: job });
  updateActionButtons(job);
  updateTaskPanelFocus(job);
  updateElapsedTicker(job);

  const header = document.createElement("div");
  header.className = "job-header";
  const titleWrap = document.createElement("div");
  const title = document.createElement("div");
  title.className = "job-title";
  title.textContent = jobTitle(job);
  const subtitle = document.createElement("div");
  subtitle.className = "job-subtitle";
  subtitle.textContent = t("taskSubtitle", { id: job.id, source: shorten(job.sourceUrl || job.source || "", 88) });
  titleWrap.append(title, subtitle);
  const stage = document.createElement("span");
  const stageKey = job.stage || progress.stage || job.status;
  stage.className = `stage stage-${stageClassName(stageKey)}`;
  stage.textContent = stageLabel(stageKey);
  header.append(titleWrap, stage);

  const metrics = document.createElement("div");
  metrics.className = "metrics";
  metrics.append(
    metric(t("metricExtract"), extractionProgressText(extraction, job.status)),
    metric(t("metricAsrTranslation"), translationProgressText(translation, job)),
    metric(t("metricCurrentStep"), extractionActivityText(extraction)),
    metric(funAsrJob ? t("metricLongFileChunk") : t("metricChunkMinutes"), chunkDurationText(job, extraction)),
    metric(t("metricReady"), extraction.readySeconds ? formatDuration(extraction.readySeconds) : "-"),
    metric(t("metricTranslating"), translation.chunksTranslating || 0),
    metric(t("metricTranslationWorkers"), translation.translationWorkers || "-"),
    metric(t("metricElapsed"), formatElapsedSeconds(progress.elapsedSeconds || translation.elapsedSeconds || 0), "elapsed")
  );

  const children = [
    header,
    progressBar(t("audioExtract"), normalizedPercent(progress.extractPercent ?? extraction.percent, job.status), extractionProgressText(extraction, job.status)),
    progressBar(t("asrTranslation"), normalizedPercent(progress.translationPercent ?? translation.percent, job.status), translationProgressText(translation, job)),
    metrics,
    chunkList(translation.chunkStatuses || progress.chunkStatuses || [])
  ];
  if (job.error) {
    const error = document.createElement("div");
    error.className = "job-error";
    error.textContent = formatRuntimeError(job.error);
    children.splice(1, 0, error);
  }
  elements.jobStatus.append(...children);
}

function renderEmptyJob(text) {
  currentJob = null;
  updateElapsedTicker(null);
  updateTaskPanelFocus(null);
  stopSubtitleFollow();
  updateActionButtons(null);
  elements.jobStatus.replaceChildren();
  const empty = document.createElement("div");
  empty.className = "job-empty";
  empty.textContent = text;
  elements.jobStatus.appendChild(empty);
}

function isFunAsrJob(job) {
  return job?.pipeline === "funasr" || job?.progress?.pipeline === "funasr";
}

function chunkDurationText(job, extraction = {}) {
  const funAsrJob = isFunAsrJob(job);
  const seconds = Number(funAsrJob ? extraction.asrChunkSeconds : extraction.chunkSeconds);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "-";
  }
  const minutes = Math.round(seconds / 60);
  if (!funAsrJob) {
    return t("minutes", { count: minutes });
  }
  if (seconds >= 3600 && seconds % 3600 === 0) {
    return t("maxHours", { count: Math.round(seconds / 3600) });
  }
  return t("maxMinutes", { count: minutes });
}

function renderCandidates(items) {
  const nextSignature = candidateListSignature(items);
  const previousScrollTop = elements.candidateList.scrollTop;
  if (nextSignature === renderedCandidateSignature) {
    updateActionButtons(currentJob);
    return;
  }
  renderedCandidateSignature = nextSignature;
  elements.candidateList.replaceChildren();
  const visibleItems = items.slice(0, 5);
  const hiddenCount = Math.max(items.length - visibleItems.length, 0);
  elements.candidateSummary.textContent = items.length
    ? t("sourcesSummary", {
      count: items.length,
      index: selectedIndex() + 1,
      hidden: hiddenCount ? t("sourcesHidden", { count: hiddenCount }) : ""
    })
    : t("sourcesEmpty");
  if (items.length) {
    clearCandidateEmptyTaskMessage();
  }
  if (!items.length) {
    updateActionButtons(currentJob);
    return;
  }
  updateActionButtons(currentJob);
  for (const [index, item] of visibleItems.entries()) {
    const key = candidateKey(item, index);
    const selected = key === selectedCandidateKey;
    const card = document.createElement("button");
    card.className = "candidate-card";
    card.type = "button";
    card.setAttribute("aria-pressed", String(selected));
    card.addEventListener("click", () => selectCandidate(key));

    const title = document.createElement("span");
    title.className = "candidate-title";
    title.textContent = item.title || item.filename || item.origin || t("unnamedMedia");
    const meta = document.createElement("span");
    meta.className = "candidate-meta";
    meta.textContent = candidateMetaText(item);
    const reason = document.createElement("span");
    reason.className = "candidate-reason";
    reason.textContent = item.selectionReason || item.url || "";
    const diagnosticText = candidateDiagnosticText(item);
    if (diagnosticText) {
      const diagnostic = document.createElement("span");
      diagnostic.className = "candidate-diagnostic";
      diagnostic.textContent = diagnosticText;
      card.append(title, meta, reason, diagnostic);
    } else {
      card.append(title, meta, reason);
    }
    elements.candidateList.appendChild(card);
  }
  elements.candidateList.scrollTop = previousScrollTop;
}

function candidateListSignature(items) {
  return JSON.stringify(
    items.map((item, index) => ({
      key: candidateKey(item, index),
      title: item.title || "",
      meta: candidateMetaText(item),
      reason: item.selectionReason || "",
      diagnostic: candidateDiagnosticText(item),
      selected: candidateKey(item, index) === selectedCandidateKey
    }))
  );
}

function selectCandidate(key) {
  selectedCandidateKey = key;
  selectedCandidatePinned = true;
  renderCandidates(candidates);
}

function ensureSelection() {
  if (!candidates.length) {
    selectedCandidateKey = "";
    selectedCandidatePinned = false;
    return;
  }
  const firstKey = candidateKey(candidates[0], 0);
  const exists = candidates.some((item, index) => candidateKey(item, index) === selectedCandidateKey);
  if (!selectedCandidatePinned || !exists) {
    selectedCandidateKey = firstKey;
    selectedCandidatePinned = false;
  }
}

function selectedIndex() {
  return Math.max(0, candidates.findIndex((item, index) => candidateKey(item, index) === selectedCandidateKey));
}

function getSelectedCandidate() {
  return candidates.find((item, index) => candidateKey(item, index) === selectedCandidateKey);
}

function candidateKey(item, index) {
  return `${item.kind || "media"}:${item.role || ""}:${item.url || index}`;
}

function toPreloadCandidate(item) {
  const {
    variants,
    variantStats,
    hiddenCount,
    selectionReason,
    asrScore,
    ...candidate
  } = item;
  return {
    ...candidate,
    variantCount: variants?.length || 1,
    selectedBecause: selectionReason,
    foldedVariantStats: variantStats
  };
}

function candidateMetaText(item) {
  const parts = [
    formatRole(item.role),
    `${item.kind || "media"}/${item.ext || "?"}`
  ];
  if (item.duration) {
    parts.push(formatDuration(item.duration));
  }
  if (item.resolution) {
    parts.push(item.resolution);
  } else if (item.quality?.label) {
    parts.push(item.quality.label);
  }
  if (item.hiddenCount) {
    parts.push(t("folded", { count: item.hiddenCount }));
  }
  if (item.source) {
    parts.push(formatSource(item.source));
  }
  return parts.filter(Boolean).join(" · ");
}

function candidateDiagnosticText(item) {
  const plan = item?.sourcePlan;
  const parts = [];
  if (plan?.kind) {
    parts.push(t("sourcePlanKind", { kind: plan.kind }));
  }
  if (plan?.executable === false) {
    parts.push(t("sourcePlanDiagnosticOnly"));
  }
  if (plan?.ffmpegInput?.type) {
    parts.push(t("sourcePlanInput", { type: plan.ffmpegInput.type }));
  }
  if (plan?.container) {
    parts.push(t("sourcePlanContainer", { name: plan.container }));
  }
  if (plan?.siteAdapter) {
    parts.push(t("sourcePlanAdapter", { name: plan.siteAdapter }));
  }
  if (item?.mediaAsset?.durationEvidence?.source) {
    parts.push(`duration:${item.mediaAsset.durationEvidence.source}`);
  }
  return parts.join(" · ");
}

async function renderSubtitles(jobId, job = null) {
  if (job?.subtitleCleared || isSubtitleJobCleared(jobId)) {
    return;
  }
  if (manualSubtitleOverrideMatches(jobId)) {
    renderedSubtitleJobId = jobId || renderedSubtitleJobId;
    renderedSubtitleSignature = manualSubtitleOverride.signature || renderedSubtitleSignature || `manual:${subtitleCues.length}`;
    if (subtitleCues.length) {
      startSubtitleFollow();
      await attachCurrentSubtitlesToPage();
    }
    return;
  }
  const requestTabKey = activeTabKey(activeTab);
  const requestCurrentJobId = currentJobId || "";
  const signature = subtitleSignature(jobId, job);
  const needsTranscriptRetry = subtitleDisplayModeRequiresTranscript(subtitleDisplayMode) && subtitleCues.length && subtitleCueSource !== "transcript";
  if (signature && renderedSubtitleSignature === signature && renderedSubtitleJobId === jobId && subtitleCues.length && !needsTranscriptRetry) {
    startSubtitleFollow();
    await attachCurrentSubtitlesToPage();
    return;
  }
  const pendingKey = `${signature || jobId}:${needsTranscriptRetry ? "transcript" : "normal"}`;
  if (pendingSubtitlePromise && pendingSubtitleSignature === pendingKey) {
    await pendingSubtitlePromise;
    return;
  }
  const requestId = ++subtitleLoadRequestId;
  pendingSubtitleSignature = pendingKey;
  const pending = loadSubtitleCues(jobId);
  pendingSubtitlePromise = pending;
  let result;
  try {
    result = await pending;
  } finally {
    if (pendingSubtitlePromise === pending) {
      pendingSubtitlePromise = null;
      pendingSubtitleSignature = "";
    }
  }
  if (!shouldApplySubtitleRenderLoad(requestId, requestTabKey, requestCurrentJobId)) {
    return;
  }
  const cues = result.cues;
  renderedSubtitleJobId = jobId || renderedSubtitleJobId;
  renderedSubtitleSignature = signature || "";
  subtitleCueSource = result.source;
  currentTranscript = result.transcript || (result.source === "transcript" ? transcriptFromCues(cues) : null);
  subtitleCues = cues;
  activeCueIndex = -1;
  renderSubtitleCueList();
  startSubtitleFollow();
  await attachCurrentSubtitlesToPage();
  if (result.source === "transcript") {
    cacheCurrentSubtitles().catch(() => {});
  }
}

function shouldApplySubtitleRenderLoad(requestId, requestTabKey, requestCurrentJobId) {
  if (requestId !== subtitleLoadRequestId) {
    return false;
  }
  if (!requestTabKey || activeTabKey(activeTab) !== requestTabKey) {
    return false;
  }
  if (requestCurrentJobId && currentJobId !== requestCurrentJobId) {
    return false;
  }
  return true;
}

async function loadSubtitleCues(jobId) {
  const transcriptResponse = await send({ type: MESSAGE.GET_PRELOAD_TRANSCRIPT, jobId });
  if (transcriptResponse.ok && transcriptResponse.transcript) {
    const transcriptCues = cuesFromTranscript(transcriptResponse.transcript);
    if (transcriptCues.length) {
      return { cues: transcriptCues, source: "transcript", transcript: transcriptResponse.transcript };
    }
  }
  const response = await send({ type: MESSAGE.GET_PRELOAD_VTT, jobId });
  if (!response.ok || !response.vtt) {
    return { cues: [], source: "empty", transcript: null };
  }
  return { cues: parseVtt(response.vtt), source: "vtt", transcript: null };
}

function renderSubtitleCueList(options = {}) {
  const preserveScroll = options.preserveScroll === true;
  const scrollState = options.scrollState || (preserveScroll ? captureSubtitleScrollState() : null);
  elements.subtitleList.replaceChildren();
  const visibleCues = visibleSubtitleCueItems();
  if (!subtitleCues.length) {
    elements.subtitleList.textContent = renderedSubtitleJobId ? t("subtitleEmptyFile") : t("subtitlePlaceholder");
    renderSubtitleNotice();
    updateTaskPanelFocus(currentJob);
    updateActionButtons(currentJob);
    if (preserveScroll) {
      restoreSubtitleScrollState(scrollState);
    }
    return;
  }
  if (!visibleCues.length) {
    elements.subtitleList.textContent = t("noRealTranslationMode");
    renderSubtitleNotice();
    updateTaskPanelFocus(currentJob);
    updateActionButtons(currentJob);
    if (preserveScroll) {
      restoreSubtitleScrollState(scrollState);
    }
    return;
  }
  for (const { cue, index } of visibleCues) {
    const item = document.createElement("div");
    item.className = "cue";
    if (subtitleEditMode) {
      item.classList.add("cue-editable");
    }
    item.dataset.index = String(index);
    const timeRow = renderSubtitleCueTimeRow(cue, index);
    const textWrap = document.createElement("div");
    textWrap.className = "subtitle-lines";
    if (cue.speakerLabel) {
      const speaker = document.createElement("div");
      speaker.className = "subtitle-speaker";
      speaker.textContent = cue.speakerLabel;
      textWrap.appendChild(speaker);
    }
    if (subtitleDisplayMode === "bilingual" && cue.sourceText && (subtitleEditMode || cue.sourceText !== cue.text)) {
      const source = document.createElement("div");
      source.className = "subtitle-source";
      source.textContent = cue.sourceText;
      textWrap.appendChild(source);
    }
    textWrap.appendChild(renderSubtitleCueTextRow(cue, index));
    item.title = t("cueJumpTitle");
    item.addEventListener("dblclick", () => seekToCue(cue.start, index));
    item.append(timeRow, textWrap);
    if (subtitleEditMode) {
      item.appendChild(renderSubtitleCueDeleteButton(index));
    }
    elements.subtitleList.appendChild(item);
  }
  if (activeCueIndex >= 0) {
    setActiveCueIndex(activeCueIndex, { suppressScroll: preserveScroll });
  } else {
    const firstVisible = visibleCues[0]?.index ?? -1;
    if (firstVisible >= 0) {
      setActiveCueIndex(firstVisible, { suppressScroll: preserveScroll });
    }
  }
  renderSubtitleModeButton();
  renderSubtitleEditButton();
  renderSubtitleNotice();
  updateTaskPanelFocus(currentJob);
  updateActionButtons(currentJob);
  if (preserveScroll) {
    restoreSubtitleScrollState(scrollState);
  }
}

function captureSubtitleScrollState() {
  const pageScroller = document.scrollingElement || document.documentElement || document.body || null;
  return {
    subtitleTop: Number(elements.subtitleList.scrollTop) || 0,
    subtitleLeft: Number(elements.subtitleList.scrollLeft) || 0,
    pageTop: Number.isFinite(window.scrollY) ? window.scrollY : Number(pageScroller?.scrollTop) || 0,
    pageLeft: Number.isFinite(window.scrollX) ? window.scrollX : Number(pageScroller?.scrollLeft) || 0
  };
}

function restoreSubtitleScrollState(state) {
  if (!state) {
    return;
  }
  const apply = () => {
    elements.subtitleList.scrollTop = state.subtitleTop;
    elements.subtitleList.scrollLeft = state.subtitleLeft;
    const pageScroller = document.scrollingElement || document.documentElement || document.body || null;
    if (typeof window.scrollTo === "function") {
      window.scrollTo(state.pageLeft, state.pageTop);
    } else if (pageScroller) {
      pageScroller.scrollTop = state.pageTop;
      pageScroller.scrollLeft = state.pageLeft;
    }
  };
  apply();
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(apply);
  }
  window.setTimeout?.(apply, 0);
}

function renderSubtitleCueTimeRow(cue, index) {
  const row = document.createElement("div");
  row.className = subtitleEditingTimeIndex === index ? "cue-time-row editing" : "cue-time-row";
  if (subtitleEditMode && subtitleEditingTimeIndex === index) {
    const timeInput = document.createElement("input");
    timeInput.className = "subtitle-time-input";
    timeInput.type = "text";
    timeInput.value = cue.time || formatCueTime(cue.start, cue.end);
    subtitleEditingTimeDraft = timeInput.value;
    timeInput.inputMode = "decimal";
    timeInput.setAttribute("aria-label", t("editSubtitleTime"));
    const finish = () => finishSubtitleCueTimeEdit(index, subtitleEditingTimeDraft || timeInput.value);
    timeInput.addEventListener("input", event => {
      subtitleEditingTimeDraft = event.target.value;
    });
    timeInput.addEventListener("blur", () => deferSubtitleInlineFinish(finish));
    timeInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault?.();
        return finish();
      } else if (event.key === "Escape") {
        event.preventDefault?.();
        return exitSubtitleCueInlineEdit({ timeIndex: index });
      }
      return undefined;
    });
    row.appendChild(timeInput);
    window.setTimeout?.(() => timeInput.focus?.(), 0);
    return row;
  }
  const time = document.createElement("div");
  time.className = "time";
  time.textContent = cue.time;
  row.appendChild(time);
  if (subtitleEditMode) {
    row.appendChild(createCueEditButton({
      className: "cue-edit-button cue-time-edit",
      icon: "edit",
      title: t("editSubtitleTime"),
      onClick: () => {
        subtitleEditingTimeIndex = subtitleEditingTimeIndex === index ? -1 : index;
        subtitleEditingTextIndex = -1;
        subtitleEditingTextDraft = "";
        subtitleEditingTimeDraft = "";
        renderSubtitleCueList({ preserveScroll: true });
      }
    }));
  }
  return row;
}

function renderSubtitleCueTextRow(cue, index) {
  const row = document.createElement("div");
  row.className = subtitleEditMode ? "subtitle-text-row editable" : "subtitle-text-row";
  if (subtitleEditMode && subtitleEditingTextIndex === index) {
    row.classList.add("editing");
    const textarea = document.createElement("textarea");
    textarea.className = "subtitle-edit-textarea";
    textarea.value = editableSubtitleCueTranslationText(cue);
    subtitleEditingTextDraft = textarea.value;
    textarea.rows = 1;
    textarea.setAttribute("aria-label", t("editSubtitleText"));
    const resize = () => resizeSubtitleEditTextarea(textarea);
    const finish = () => finishSubtitleCueTextEdit(index, subtitleEditingTextDraft);
    textarea.addEventListener("input", event => {
      subtitleEditingTextDraft = event.target.value;
      resize();
    });
    textarea.addEventListener("blur", () => deferSubtitleInlineFinish(finish));
    textarea.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault?.();
        return finish();
      } else if (event.key === "Escape") {
        event.preventDefault?.();
        return exitSubtitleCueInlineEdit({ textIndex: index });
      }
      return undefined;
    });
    row.appendChild(textarea);
    window.setTimeout?.(() => {
      resize();
      textarea.focus?.();
    }, 0);
    return row;
  }
  const text = document.createElement("div");
  text.className = "subtitle-text";
  text.textContent = subtitleEditMode
    ? editableSubtitleCueTranslationText(cue)
    : subtitleCueTextLines(cue, subtitleDisplayMode).slice(-1)[0] || "";
  row.appendChild(text);
  if (subtitleEditMode) {
    row.appendChild(createCueEditButton({
      className: "cue-edit-button cue-text-edit",
      icon: "edit",
      title: t("editSubtitleText"),
      onClick: () => {
        subtitleEditingTextIndex = subtitleEditingTextIndex === index ? -1 : index;
        subtitleEditingTimeIndex = -1;
        subtitleEditingTextDraft = "";
        subtitleEditingTimeDraft = "";
        renderSubtitleCueList({ preserveScroll: true });
      }
    }));
  }
  return row;
}

function renderSubtitleCueDeleteButton(index) {
  return createCueEditButton({
    className: "cue-edit-button cue-delete",
    icon: "delete",
    title: t("deleteSubtitleCue"),
    onClick: () => deleteSubtitleCueAtIndex(index)
  });
}

function createCueEditButton({ className, label, icon, title, onClick }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  if (icon) {
    button.innerHTML = cueEditIconSvg(icon);
  } else {
    button.textContent = label;
  }
  button.title = title;
  button.setAttribute("aria-label", title);
  button.addEventListener("pointerdown", event => {
    event.preventDefault?.();
  });
  button.addEventListener("click", event => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    return onClick?.();
  });
  return button;
}

function cueEditIconSvg(icon) {
  if (icon === "delete") {
    return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>';
  }
  return '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12.5l.6-2.6 7.6-7.6a1.5 1.5 0 0 1 2.1 2.1L5.7 12l-2.7.5z"/><path d="M10.2 3.3l2.5 2.5"/></svg>';
}

function clearSubtitles(text, jobId = "") {
  subtitleLoadRequestId += 1;
  pendingSubtitlePromise = null;
  pendingSubtitleSignature = "";
  renderedSubtitleJobId = jobId || "";
  renderedSubtitleSignature = "";
  manualSubtitleOverride = null;
  attachedSubtitleTabId = 0;
  attachedSubtitleSignature = "";
  subtitleCues = [];
  subtitleCueSource = "";
  currentTranscript = null;
  currentSubtitleCacheEntry = null;
  cachedSubtitleLoadedKey = "";
  activeCueIndex = -1;
  subtitleEditMode = false;
  subtitleEditingTextIndex = -1;
  subtitleEditingTimeIndex = -1;
  subtitleEditingTextDraft = "";
  subtitleEditingTimeDraft = "";
  taskDetailsExpanded = false;
  taskDetailsManuallyCollapsed = false;
  stopSubtitleFollow();
  renderSubtitleNotice("");
  renderSubtitleEditButton();
  elements.subtitleList.replaceChildren();
  elements.subtitleList.textContent = text || t("subtitlePlaceholder");
  updateTaskPanelFocus(currentJob);
}

async function seekToCue(start, preferredIndex = null) {
  const time = Number(start);
  if (!activeTab?.id || !Number.isFinite(time)) {
    return;
  }
  const response = await send({ type: MESSAGE.SEEK_MEDIA, tabId: activeTab.id, time });
  if (response.ok) {
    releaseSubtitleListAutoFollow();
    const index = Number.isInteger(preferredIndex) && preferredIndex >= 0 ? preferredIndex : findCueIndexForProgress(time);
    activeCueIndex = -1;
    setActiveCueIndex(index, { forceScroll: true });
  }
  setMessage(response.ok ? t("seekDone") : response.error);
}

function startSubtitleFollow() {
  if (subtitleFollowTimer || !subtitleCues.length) {
    return;
  }
  syncSubtitleHighlight();
  subtitleFollowTimer = window.setInterval(syncSubtitleHighlight, 500);
}

function stopSubtitleFollow() {
  if (!subtitleFollowTimer) {
    return;
  }
  window.clearInterval(subtitleFollowTimer);
  subtitleFollowTimer = 0;
}

async function syncSubtitleHighlight() {
  if (subtitleFollowBusy || !activeTab?.id || !subtitleCues.length) {
    return;
  }
  subtitleFollowBusy = true;
  try {
    const response = await send({ type: MESSAGE.GET_VIDEO_STATE, tabId: activeTab.id });
    const time = Number(response.state?.currentTime);
    if (
      response.ok
      && response.state?.synthetic !== true
      && Number.isFinite(time)
    ) {
      setActiveCueIndex(findCueIndexForProgress(time), { suppressScroll: subtitleEditMode });
    }
  } finally {
    subtitleFollowBusy = false;
  }
}

function visibleSubtitleCueItems() {
  return subtitleCues
    .map((cue, index) => ({ cue, index }))
    .filter(item => shouldIncludeCueInSubtitleOutput(item.cue, subtitleDisplayMode, subtitleCues));
}

function findCueIndexAt(time) {
  const current = Number(time);
  if (!Number.isFinite(current)) {
    return -1;
  }
  const startTolerance = 0.001;
  let bestIndex = -1;
  let bestStart = Number.NEGATIVE_INFINITY;
  subtitleCues.forEach((cue, index) => {
    const start = Number(cue.start);
    const end = Number(cue.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return;
    }
    if (current + startTolerance < start) {
      return;
    }
    if (!(current < end || (index === subtitleCues.length - 1 && current <= end + startTolerance))) {
      return;
    }
    if (start >= bestStart) {
      bestStart = start;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function findCueIndexForProgress(time) {
  const current = Number(time);
  if (!Number.isFinite(current)) {
    return -1;
  }
  const visibleCues = visibleSubtitleCueItems();
  if (!visibleCues.length) {
    return -1;
  }
  const exactIndex = findCueIndexAt(current);
  if (visibleCues.some(item => item.index === exactIndex)) {
    return exactIndex;
  }
  let previousIndex = visibleCues[0].index;
  for (const { cue, index } of visibleCues) {
    const start = Number(cue.start);
    const end = Number(cue.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      continue;
    }
    if (current < start) {
      return previousIndex;
    }
    previousIndex = index;
    if (current < end || index === visibleCues[visibleCues.length - 1].index) {
      return index;
    }
  }
  return previousIndex;
}

function markSubtitleListUserControl() {
  subtitleListUserControlUntil = Date.now() + SUBTITLE_USER_SCROLL_HOLD_MS;
}

function releaseSubtitleListAutoFollow() {
  subtitleListPointerInside = false;
  subtitleListUserControlUntil = 0;
}

function shouldScrollActiveCue(options = {}) {
  if (options.suppressScroll) {
    return false;
  }
  if (options.forceScroll) {
    return true;
  }
  if (!subtitleListPointerInside) {
    return true;
  }
  return Date.now() >= subtitleListUserControlUntil;
}

function setActiveCueIndex(index, options = {}) {
  const nextIndex = Number(index);
  const current = Number.isInteger(nextIndex) && nextIndex >= 0
    ? elements.subtitleList.querySelector(`.cue[data-index="${nextIndex}"]`)
    : null;
  elements.subtitleList.querySelectorAll(".cue.active").forEach(item => {
    if (item !== current) {
      item.classList.remove("active");
    }
  });
  if (activeCueIndex === nextIndex && current?.classList.contains("active") && !options.forceScroll) {
    return;
  }
  activeCueIndex = Number.isInteger(nextIndex) ? nextIndex : -1;
  if (!current) {
    return;
  }
  current.classList.add("active");
  if (shouldScrollActiveCue(options)) {
    current.scrollIntoView({ block: "nearest" });
  }
}

async function toggleSubtitleMode() {
  subtitleDisplayMode = nextSubtitleDisplayMode(subtitleDisplayMode);
  if (subtitleEditMode && subtitleDisplayMode === "source") {
    subtitleDisplayMode = "bilingual";
  }
  await chrome.storage.sync.set({ subtitleDisplayMode }).catch(() => {});
  renderSubtitleCueList({ preserveScroll: subtitleEditMode });
  if (subtitleDisplayModeRequiresTranscript(subtitleDisplayMode) && renderedSubtitleJobId && subtitleCueSource !== "transcript") {
    renderedSubtitleSignature = "";
    await renderSubtitles(renderedSubtitleJobId, currentJob);
  }
  if (activeCueIndex >= 0) {
    const index = activeCueIndex;
    activeCueIndex = -1;
    setActiveCueIndex(index, subtitleEditMode ? { suppressScroll: true } : { forceScroll: true });
  }
  await attachCurrentSubtitlesToPage();
}

async function toggleSubtitleEditMode() {
  if (!subtitleCues.length) {
    return;
  }
  subtitleEditMode = !subtitleEditMode;
  subtitleEditingTextIndex = -1;
  subtitleEditingTimeIndex = -1;
  subtitleEditingTextDraft = "";
  subtitleEditingTimeDraft = "";
  if (subtitleEditMode && subtitleDisplayMode === "source") {
    subtitleDisplayMode = "bilingual";
    await chrome.storage.sync.set({ subtitleDisplayMode }).catch(() => {});
  }
  renderSubtitleCueList({ preserveScroll: true });
  renderSubtitleEditButton();
}

function nextSubtitleDisplayMode(mode) {
  const normalized = normalizeSubtitleDisplayMode(mode);
  if (normalized === "translated") {
    return "source";
  }
  if (normalized === "source") {
    return "bilingual";
  }
  return "translated";
}

function subtitleDisplayModeRequiresTranscript(mode) {
  return normalizeSubtitleDisplayMode(mode) !== "translated";
}

async function toggleSubtitleOverlay() {
  await setSubtitleOverlayEnabled(!subtitleOverlayEnabled);
}

async function setSubtitleOverlayEnabled(enabled) {
  subtitleOverlayEnabled = enabled !== false;
  renderSubtitleOverlayButton();
  await chrome.storage.sync.set({ subtitleOverlayEnabled }).catch(() => {});
  if (subtitleOverlayEnabled) {
    await attachCurrentSubtitlesToPage();
  } else {
    await detachCurrentSubtitlesFromPage();
    renderSubtitleNotice();
  }
}

function renderSubtitleModeButton() {
  const mode = normalizeSubtitleDisplayMode(subtitleDisplayMode);
  const labelKey = {
    translated: "subtitleModeTranslated",
    source: "subtitleModeSource",
    bilingual: "subtitleModeBilingual"
  }[mode];
  elements.subtitleModeToggle.textContent = t(labelKey);
  elements.subtitleModeToggle.dataset.mode = mode;
  elements.subtitleModeToggle.dataset.active = String(mode !== "source");
  elements.subtitleModeToggle.setAttribute("aria-label", t(labelKey));
  elements.subtitleModeToggle.removeAttribute("aria-pressed");
}

function renderSubtitleEditButton() {
  elements.subtitleEditToggle.textContent = subtitleEditMode ? t("doneEditingSubtitles") : t("editSubtitles");
  elements.subtitleEditToggle.setAttribute("aria-pressed", String(subtitleEditMode));
  elements.subtitleEditToggle.disabled = subtitleEditButtonShouldBeDisabled();
}

function subtitleEditButtonShouldBeDisabled(job = currentJob) {
  return !subtitleCues.length || isRunningJob(job);
}

function renderSubtitleOverlayButton() {
  elements.subtitleOverlayToggle.textContent = subtitleOverlayEnabled ? t("overlayOn") : t("overlayOff");
  elements.subtitleOverlayToggle.setAttribute("aria-pressed", String(subtitleOverlayEnabled));
}

function editableSubtitleCueTranslationText(cue) {
  return cue?.sourceOnly ? "" : String(cue?.text || "");
}

function resizeSubtitleEditTextarea(textarea) {
  if (!textarea?.style || !Number.isFinite(textarea.scrollHeight)) {
    return;
  }
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function deferSubtitleInlineFinish(callback) {
  if (typeof window.setTimeout === "function") {
    window.setTimeout(callback, 0);
    return undefined;
  }
  return callback();
}

async function handleSubtitleInlineEditPointerDown(event) {
  if (!hasActiveSubtitleInlineEdit() || isSubtitleInlineEditTarget(event?.target)) {
    return false;
  }
  return finishActiveSubtitleInlineEdit();
}

function hasActiveSubtitleInlineEdit() {
  return subtitleEditingTextIndex >= 0 || subtitleEditingTimeIndex >= 0;
}

function isSubtitleInlineEditTarget(target) {
  let node = target || null;
  while (node) {
    const className = typeof node.className === "string"
      ? node.className
      : String(node.className?.baseVal || "");
    const classes = className.split(/\s+/);
    if (classes.includes("subtitle-edit-textarea") || classes.includes("subtitle-time-input")) {
      return true;
    }
    if (typeof node.matches === "function" && node.matches(".subtitle-edit-textarea, .subtitle-time-input")) {
      return true;
    }
    node = node.parentElement || node.parentNode || null;
  }
  return false;
}

async function finishActiveSubtitleInlineEdit() {
  if (subtitleEditingTextIndex >= 0) {
    return finishSubtitleCueTextEdit(subtitleEditingTextIndex, subtitleEditingTextDraft);
  }
  if (subtitleEditingTimeIndex >= 0) {
    return finishSubtitleCueTimeEdit(subtitleEditingTimeIndex, subtitleEditingTimeDraft);
  }
  return false;
}

async function finishSubtitleCueTextEdit(index, rawText) {
  if (subtitleEditingTextIndex !== index) {
    return false;
  }
  await applySubtitleCueTextEdit(index, rawText);
  if (subtitleEditingTextIndex === index) {
    subtitleEditingTextIndex = -1;
    subtitleEditingTextDraft = "";
    renderSubtitleCueList({ preserveScroll: true });
  }
  return true;
}

async function finishSubtitleCueTimeEdit(index, rawTime) {
  if (subtitleEditingTimeIndex !== index) {
    return false;
  }
  const saved = await applySubtitleCueTimeEdit(index, rawTime);
  if (saved && subtitleEditingTimeIndex === index) {
    subtitleEditingTimeIndex = -1;
    subtitleEditingTimeDraft = "";
    renderSubtitleCueList({ preserveScroll: true });
  }
  return saved;
}

function exitSubtitleCueInlineEdit({ textIndex = -1, timeIndex = -1 } = {}) {
  if (subtitleEditingTextIndex === textIndex) {
    subtitleEditingTextIndex = -1;
    subtitleEditingTextDraft = "";
  }
  if (subtitleEditingTimeIndex === timeIndex) {
    subtitleEditingTimeIndex = -1;
    subtitleEditingTimeDraft = "";
  }
  renderSubtitleCueList({ preserveScroll: true });
}

async function applySubtitleCueTextEdit(index, rawText) {
  const cue = subtitleCues[index];
  if (!cue) {
    return false;
  }
  ensureEditableTranscript();
  const text = normalizeEditedSubtitleText(rawText);
  const sourceText = subtitleCueSourceText(cue);
  cue.text = text || sourceText;
  cue.sourceText = sourceText;
  cue.sourceOnly = !text && Boolean(sourceText);
  upsertTranscriptSegment("translated", index, cue, text);
  await persistSubtitleEdits();
  return true;
}

async function applySubtitleCueTimeEdit(index, rawTime) {
  const cue = subtitleCues[index];
  if (!cue) {
    return false;
  }
  const [startRaw, endRaw] = String(rawTime || "").split(/\s*-->\s*/);
  const start = parseTimestamp(startRaw);
  const end = parseTimestamp(endRaw);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !subtitleCueTimeRangeCanBeSaved(index, start, end)) {
    renderSubtitleNotice(t("subtitleInvalidTime"));
    return false;
  }
  ensureEditableTranscript();
  cue.start = start;
  cue.end = end;
  cue.time = formatCueTime(start, end);
  updateTranscriptSegmentTime("source", index, cue, start, end);
  updateTranscriptSegmentTime("translated", index, cue, start, end);
  await persistSubtitleEdits();
  return true;
}

function subtitleCueTimeRangeCanBeSaved(index, start, end) {
  const previous = subtitleCues[index - 1];
  const next = subtitleCues[index + 1];
  const tolerance = 0.001;
  if (previous && Number(previous.end || 0) - start > tolerance) {
    return false;
  }
  if (next && end - Number(next.start || 0) > tolerance) {
    return false;
  }
  return true;
}

async function deleteSubtitleCueAtIndex(index) {
  if (!subtitleCues[index]) {
    return;
  }
  const scrollState = captureSubtitleScrollState();
  ensureEditableTranscript();
  removeTranscriptSegment("source", index, subtitleCues[index]);
  removeTranscriptSegment("translated", index, subtitleCues[index]);
  subtitleCues.splice(index, 1);
  if (activeCueIndex === index) {
    activeCueIndex = -1;
  } else if (activeCueIndex > index) {
    activeCueIndex -= 1;
  }
  subtitleEditingTextIndex = -1;
  subtitleEditingTimeIndex = -1;
  if (!subtitleCues.length) {
    subtitleEditMode = false;
  }
  await persistSubtitleEdits();
  renderSubtitleCueList({ preserveScroll: true, scrollState });
}

function ensureEditableTranscript() {
  if (!currentTranscript || typeof currentTranscript !== "object") {
    currentTranscript = transcriptFromCues(subtitleCues);
  }
  if (!Array.isArray(currentTranscript.source)) {
    currentTranscript.source = [];
  }
  if (!Array.isArray(currentTranscript.translated)) {
    currentTranscript.translated = [];
  }
  if (!Array.isArray(currentTranscript.chunkStatuses)) {
    currentTranscript.chunkStatuses = [];
  }
}

function normalizeEditedSubtitleText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function upsertTranscriptSegment(kind, index, cue, text) {
  ensureEditableTranscript();
  const list = currentTranscript[kind];
  let segment = findTranscriptSegment(kind, index, cue);
  if (!segment) {
    segment = buildTranscriptSegmentFromCue(cue, text);
    list.splice(Math.min(index, list.length), 0, segment);
  }
  segment.start = cue.start;
  segment.end = cue.end;
  segment.text = text;
  if (cue.speakerLabel) {
    segment.speakerLabel = cue.speakerLabel;
  }
}

function updateTranscriptSegmentTime(kind, index, cue, start, end) {
  const segment = findTranscriptSegment(kind, index, cue);
  if (!segment) {
    return;
  }
  segment.start = start;
  segment.end = end;
}

function removeTranscriptSegment(kind, index, cue) {
  ensureEditableTranscript();
  const list = currentTranscript[kind];
  const segmentIndex = findTranscriptSegmentIndex(kind, index, cue);
  if (segmentIndex >= 0) {
    list.splice(segmentIndex, 1);
  }
}

function findTranscriptSegment(kind, index, cue) {
  const list = currentTranscript?.[kind];
  const segmentIndex = findTranscriptSegmentIndex(kind, index, cue);
  return segmentIndex >= 0 && Array.isArray(list) ? list[segmentIndex] : null;
}

function findTranscriptSegmentIndex(kind, index, cue) {
  const list = currentTranscript?.[kind];
  if (!Array.isArray(list)) {
    return -1;
  }
  const key = editableCueIdentityKey(cue);
  if (key) {
    const keyedIndex = list.findIndex(segment => segmentIdentityKey(segment) === key);
    if (keyedIndex >= 0) {
      return keyedIndex;
    }
  }
  return list[index] ? index : -1;
}

function editableCueIdentityKey(cue) {
  const chunkIndex = Number(cue?.chunkIndex);
  const segmentIndex = Number(cue?.segmentIndex);
  if (Number.isFinite(chunkIndex) && Number.isFinite(segmentIndex)) {
    return `${chunkIndex}:${segmentIndex}`;
  }
  return "";
}

function buildTranscriptSegmentFromCue(cue, text) {
  const segment = {
    start: cue.start,
    end: cue.end,
    text
  };
  if (cue.speakerLabel) {
    segment.speakerLabel = cue.speakerLabel;
  }
  const chunkIndex = Number(cue?.chunkIndex);
  const segmentIndex = Number(cue?.segmentIndex);
  if (Number.isFinite(chunkIndex) && Number.isFinite(segmentIndex)) {
    segment.chunkIndex = chunkIndex;
    segment.segmentIndex = segmentIndex;
  }
  return segment;
}

async function persistSubtitleEdits() {
  renderedSubtitleSignature = `edited:${Date.now()}:${subtitleCues.length}`;
  markManualSubtitleOverride(renderedSubtitleSignature);
  if (!subtitleCues.length) {
    const ids = new Set([cachedSubtitleLoadedKey, currentSubtitleCacheEntry?.id].filter(Boolean));
    const currentPageKey = await buildSubtitleCacheKeyForCurrentPage().catch(() => "");
    if (currentPageKey) {
      ids.add(currentPageKey);
    }
    if (ids.size) {
      await deleteSubtitleCacheEntries([...ids]);
    }
    currentSubtitleCacheEntry = null;
    cachedSubtitleLoadedKey = "";
    await detachCurrentSubtitlesFromPage();
    return;
  }
  await cacheCurrentSubtitles();
  await attachCurrentSubtitlesToPage();
}

function markManualSubtitleOverride(signature = "") {
  const jobId = currentJobId || renderedSubtitleJobId || currentSubtitleCacheEntry?.jobId || "";
  if (!jobId) {
    return;
  }
  subtitleLoadRequestId += 1;
  pendingSubtitlePromise = null;
  pendingSubtitleSignature = "";
  manualSubtitleOverride = {
    jobId: String(jobId),
    tabKey: activeTabKey(activeTab),
    signature: signature || `manual:${Date.now()}:${subtitleCues.length}`
  };
}

function manualSubtitleOverrideMatches(jobId) {
  if (!jobId || !manualSubtitleOverride) {
    return false;
  }
  return manualSubtitleOverride.jobId === String(jobId) &&
    manualSubtitleOverride.tabKey === activeTabKey(activeTab);
}

function renderSubtitleNotice(forcedText = null) {
  const text = forcedText ?? subtitleNoticeText();
  elements.subtitleNotice.hidden = !text;
  elements.subtitleNotice.textContent = text || "";
}

function subtitleNoticeText() {
  if (!subtitleCues.length) {
    return "";
  }
  const runningPartialText = subtitleRunningPartialTranslationNoticeText();
  if (runningPartialText) {
    return runningPartialText;
  }
  const sourcePreviewText = subtitleSourcePreviewNoticeText();
  if (sourcePreviewText) {
    return sourcePreviewText;
  }
  if (currentSubtitleCacheEntry) {
    return t("cacheLoaded", { title: currentSubtitleCacheEntry.title || t("unnamedSubtitle") });
  }
  if (subtitleDisplayMode === "bilingual") {
    if (subtitleCueSource !== "transcript") {
      return t("bilingualNeedsSource");
    }
    if (!subtitleCues.some(cue => cue.sourceText)) {
      return t("onlyTranslationTrack");
    }
  }
  return "";
}

function subtitleRunningPartialTranslationNoticeText() {
  if (!isRunningJob(currentJob) || subtitleCueSource !== "transcript" || !currentTranscript || !hasRealTranslatedSubtitles()) {
    return "";
  }
  const stage = currentJob?.stage || currentJob?.progress?.stage || "";
  if (["translated", "completed", "completed_with_warnings"].includes(stage)) {
    return "";
  }
  const progress = partialTranslationNoticeProgress(currentJob, currentTranscript);
  if (!progress || progress.done <= 0 || progress.total <= 0 || progress.done >= progress.total) {
    return "";
  }
  return t("partialTranslationReady", progress);
}

function partialTranslationNoticeProgress(job, transcript) {
  const translation = job?.translation || job?.progress?.translation || {};
  const statuses = job?.translation?.chunkStatuses || job?.progress?.chunkStatuses || job?.progress?.translation?.chunkStatuses || [];
  const total = firstPositiveInteger(
    translation.chunksTotal,
    job?.progress?.chunksTotal,
    Array.isArray(statuses) ? statuses.length : 0,
    transcriptChunkCount(transcript?.source),
    transcriptChunkCount(transcript?.translated)
  );
  const done = Math.max(
    firstPositiveInteger(translation.chunksDone, job?.progress?.chunksDone),
    completedTranslatedChunkStatusCount(statuses),
    transcriptChunkCount(transcript?.translated)
  );
  if (!total || !done) {
    return null;
  }
  return { done: Math.min(done, total), total };
}

function firstPositiveInteger(...values) {
  for (const value of values) {
    const number = Math.trunc(Number(value));
    if (Number.isFinite(number) && number > 0) {
      return number;
    }
  }
  return 0;
}

function completedTranslatedChunkStatusCount(statuses) {
  if (!Array.isArray(statuses) || !statuses.length) {
    return 0;
  }
  return statuses.filter(status => {
    const stage = String(status?.stage || "");
    if (!["completed", "completed_with_warnings", "done"].includes(stage)) {
      return false;
    }
    const translatedCount = Number(status?.translatedCount || status?.translatedSegments || status?.translated_segments || 0);
    const sourceCount = Number(status?.sourceCount || status?.sourceSegments || status?.source_segments || 0);
    return translatedCount > 0 || sourceCount > 0;
  }).length;
}

function transcriptChunkCount(segments) {
  if (!Array.isArray(segments) || !segments.length) {
    return 0;
  }
  const indexes = new Set();
  let hasUnindexedText = false;
  for (const segment of segments) {
    if (!cleanSubtitleText(segment?.text || "")) {
      continue;
    }
    const index = Number(segment?.chunkIndex);
    if (Number.isInteger(index) && index >= 0) {
      indexes.add(index);
    } else {
      hasUnindexedText = true;
    }
  }
  if (indexes.size) {
    return indexes.size;
  }
  return hasUnindexedText ? 1 : 0;
}

function subtitleSourcePreviewNoticeText() {
  if (subtitleCueSource !== "transcript" || !currentTranscript) {
    return "";
  }
  const sourceCount = Array.isArray(currentTranscript.source) ? currentTranscript.source.length : 0;
  const translatedCount = Array.isArray(currentTranscript.translated) ? currentTranscript.translated.length : 0;
  if (!sourceCount) {
    return "";
  }
  if (!translatedCount) {
    return t("sourcePreview");
  }
  if (translatedCount < sourceCount) {
    return t("partialTranslationPreview");
  }
  return "";
}

function toggleTaskDetails() {
  const currentlyFocusedOnSubtitles = elements.taskPanel.classList.contains("subtitles-focus");
  taskDetailsExpanded = currentlyFocusedOnSubtitles;
  taskDetailsManuallyCollapsed = !currentlyFocusedOnSubtitles;
  updateTaskPanelFocus(currentJob);
}

function updateTaskPanelFocus(job) {
  const ready = hasDisplayableSubtitles() || isCompleteJobWithSubtitles(job);
  const autoFocusReady = hasRealTranslatedSubtitles() || isCompleteJobWithTranslatedSubtitles(job);
  const focusSubtitles = ready && !taskDetailsExpanded && (autoFocusReady || taskDetailsManuallyCollapsed);
  elements.taskPanel.classList.toggle("subtitles-focus", focusSubtitles);
  elements.toggleTaskDetails.hidden = !ready;
  elements.toggleTaskDetails.textContent = focusSubtitles ? t("taskDetails") : t("collapseTask");
}

function hasDisplayableSubtitles() {
  return subtitleCues.some(cue => shouldIncludeCueInSubtitleOutput(cue, subtitleDisplayMode, subtitleCues));
}

function hasRealTranslatedSubtitles() {
  return subtitleCues.some(cue => !cue?.sourceOnly && cleanSubtitleText(cue?.text || ""));
}

function isCompleteJobWithSubtitles(job) {
  if (!job) {
    return false;
  }
  if (job.subtitleCleared) {
    return false;
  }
  const translation = job.translation || job.progress?.translation || {};
  const status = job.status || job.progress?.status;
  const stage = job.stage || job.progress?.stage;
  return (
    Number(translation.segmentCount || 0) > 0 &&
    Number(translation.chunksFailed || job.progress?.chunksFailed || 0) === 0 &&
    (status === "done" || status === "completed" || stage === "translated" || stage === "completed")
  );
}

function isCompleteJobWithTranslatedSubtitles(job) {
  if (!isCompleteJobWithSubtitles(job)) {
    return false;
  }
  const translation = job.translation || job.progress?.translation || {};
  return Number(translation.translatedSegments || 0) > 0;
}

function progressBar(label, percent, text) {
  const row = document.createElement("div");
  row.className = "progress-row";
  const head = document.createElement("div");
  head.className = "progress-label";
  const left = document.createElement("span");
  left.textContent = label;
  const right = document.createElement("span");
  right.textContent = text;
  head.append(left, right);
  const track = document.createElement("div");
  track.className = "progress-track";
  const fill = document.createElement("div");
  fill.className = "progress-fill";
  fill.style.width = `${percent}%`;
  track.appendChild(fill);
  row.append(head, track);
  return row;
}

function metric(label, value, key = "") {
  const item = document.createElement("div");
  item.className = "metric";
  if (key) {
    item.dataset.metric = key;
  }
  const labelNode = document.createElement("span");
  labelNode.textContent = label;
  const valueNode = document.createElement("strong");
  if (key) {
    valueNode.dataset.metricValue = key;
  }
  valueNode.textContent = value || "-";
  item.append(labelNode, valueNode);
  return item;
}

function updateElapsedTicker(job) {
  const running = isRunningJob(job);
  if (!running && elapsedTicker) {
    window.clearInterval(elapsedTicker);
    elapsedTicker = 0;
    return;
  }
  if (!running || elapsedTicker) {
    return;
  }
  elapsedTicker = window.setInterval(() => {
    if (!isRunningJob(currentJob)) {
      updateElapsedTicker(null);
      return;
    }
    const valueNode = document.querySelector('[data-metric-value="elapsed"]');
    if (!valueNode) {
      return;
    }
    const startedAt = Number(currentJob?.createdAt || currentJob?.startedAt || 0);
    const current = Number(currentJob?.progress?.elapsedSeconds || currentJob?.extract?.elapsedSeconds || 0) || 0;
    const liveElapsed = startedAt > 0 ? Math.max(current, (Date.now() - startedAt) / 1000) : current;
    valueNode.textContent = formatElapsedSeconds(liveElapsed);
    const waiting = document.querySelector(".chunks .job-empty");
    if (waiting && (!currentJob?.translation?.chunkStatuses || !currentJob.translation.chunkStatuses.length)) {
      waiting.textContent = waitingFirstChunkText(currentJob);
    }
  }, 1000);
}

function chunkList(statuses) {
  const list = document.createElement("div");
  list.className = "chunks";
  if (!statuses.length) {
    const empty = document.createElement("div");
    empty.className = "job-empty";
    empty.textContent = waitingFirstChunkText(currentJob);
    list.appendChild(empty);
    return list;
  }
  for (const status of statuses) {
    const row = document.createElement("div");
    row.className = `chunk ${status.stage || "queued"}`;
    const index = document.createElement("code");
    index.textContent = `#${Number(status.index) + 1}`;
    const stage = document.createElement("span");
    stage.textContent = chunkStageLabel(status.stage);
    const meta = document.createElement("span");
    meta.textContent = chunkMetaText(status);
    const error = document.createElement("div");
    error.className = "chunk-error";
    error.textContent = status.error ? friendlyChunkError(status.error) : "";
    row.append(index, stage, meta);
    if (["failed", "completed_with_warnings"].includes(status.stage)) {
      const running = isRunningJob(currentJob);
      const audioCacheRemoved = Boolean(currentJob?.audioCacheRemoved);
      const needsAsrRetry = chunkNeedsAsrRetry(status);
      const sourceAvailable = chunkHasReusableSource(status) && !needsAsrRetry;
      const retry = document.createElement("button");
      retry.className = "chunk-retry";
      retry.type = "button";
      retry.textContent = sourceAvailable ? t("retranslateShort") : t("retry");
      retry.disabled = running || (!sourceAvailable && audioCacheRemoved) || retryingChunks.has(Number(status.index));
      retry.title = audioCacheRemoved
        ? (sourceAvailable ? t("chunkRetranslateTitle") : t("retryNeedsExtractTitle"))
        : running
          ? t("chunkRetryRunningTitle")
          : (sourceAvailable ? t("chunkRetranslateTitle") : t("chunkRetryTitle"));
      retry.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        retryChunkFromSidePanel(Number(status.index), { translationOnly: sourceAvailable });
      });
      row.appendChild(retry);
    }
    if (error.textContent) {
      row.appendChild(error);
    }
    list.appendChild(row);
  }
  return list;
}

function chunkHasReusableSource(status) {
  return Number(status?.sourceCount || status?.source_segments || status?.sourceSegments || 0) > 0;
}

function chunkNeedsAsrRetry(status) {
  return Number(status?.asrFailures || status?.asr_failures || 0) > 0;
}

async function attachCurrentSubtitlesToPage() {
  if (!activeTab?.id || !subtitleCues.length) {
    return;
  }
  if (!subtitleOverlayEnabled) {
    await detachCurrentSubtitlesFromPage();
    return;
  }
  const vtt = cuesToVtt(subtitleCues);
  if (!hasDisplayableSubtitleVtt(vtt)) {
    await detachCurrentSubtitlesFromPage();
    renderSubtitleNotice();
    return;
  }
  const requestContext = captureSidepanelRequestContext();
  const signature = subtitleAttachSignature(requestContext.tabId, vtt);
  const response = await send({ type: MESSAGE.ATTACH_VTT_TEXT, tabId: requestContext.tabId, vtt });
  if (!response.ok) {
    renderSubtitleNotice(response.error || t("noPlayer"));
    return;
  }
  if (!sidepanelRequestContextStillCurrent(requestContext)) {
    await detachSubtitlesFromTab(requestContext.tabId);
    return;
  }
  attachedSubtitleTabId = requestContext.tabId;
  attachedSubtitleSignature = signature;
  renderSubtitleNotice();
}

async function ensureCurrentSubtitlesAttachedToPage() {
  if (!activeTab?.id || !subtitleCues.length) {
    return;
  }
  if (!subtitleOverlayEnabled) {
    await detachCurrentSubtitlesFromPage();
    return;
  }
  const vtt = cuesToVtt(subtitleCues);
  if (!hasDisplayableSubtitleVtt(vtt)) {
    await detachCurrentSubtitlesFromPage();
    return;
  }
  const signature = subtitleAttachSignature(activeTab.id, vtt);
  if (attachedSubtitleTabId === activeTab.id && attachedSubtitleSignature === signature) {
    const stateResponse = await send({ type: MESSAGE.GET_VIDEO_STATE, tabId: activeTab.id }).catch(() => null);
    if (
      stateResponse?.ok &&
      stateResponse.state?.subtitleSignature === signature &&
      Number(stateResponse.state?.subtitleCueCount || 0) > 0
    ) {
      return;
    }
  }
  await attachCurrentSubtitlesToPage();
}

async function detachCurrentSubtitlesFromPage() {
  if (!activeTab?.id) {
    attachedSubtitleTabId = 0;
    attachedSubtitleSignature = "";
    return;
  }
  await detachSubtitlesFromTab(activeTab.id);
}

async function detachSubtitlesFromTab(tabId) {
  if (attachedSubtitleTabId === tabId) {
    attachedSubtitleTabId = 0;
    attachedSubtitleSignature = "";
  }
  if (!tabId) {
    return;
  }
  await send({ type: MESSAGE.DETACH_PRELOAD_VTT, tabId }).catch(() => null);
}

function subtitleAttachSignature(tabId, vtt) {
  const text = String(vtt || "");
  // Must match background attachVttText(); the page reports that signature back.
  return `manual:${vttContentSignature(text)}`;
}

function hasDisplayableSubtitleVtt(vtt) {
  return /-->/.test(String(vtt || ""));
}

function vttContentSignature(vtt) {
  const text = String(vtt || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return `${text.length}:${Math.abs(hash)}`;
}

async function cacheCurrentSubtitles() {
  if (!subtitleCues.length) {
    return;
  }
  const transcript = currentTranscript || transcriptFromCues(subtitleCues);
  if (isRunningJob(currentJob) && !transcriptHasRealTranslatedCue(transcript)) {
    return;
  }
  if (!transcriptHasDisplayableCues(transcript, subtitleDisplayMode, { allowRunningSourcePreview: false })) {
    return;
  }
  const entry = await buildSubtitleCacheEntry(transcript, transcript?.metadata || {});
  if (!entry.id) {
    return;
  }
  await putSubtitleCacheEntry(entry);
  currentSubtitleCacheEntry = entry;
  cachedSubtitleLoadedKey = entry.id;
  renderSubtitleNotice();
}

async function exportCurrentSubtitle() {
  if (!subtitleCues.length) {
    setMessage(t("noExportSubtitle"));
    return;
  }
  const srt = cuesToSrt(subtitleCues, subtitleDisplayMode, {
    allowRunningSourcePreview: false,
    srtMetadata: buildSrtExportMetadata()
  });
  if (!/\d+\n\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}/.test(srt)) {
    setMessage(t("noExportRealTranslation"));
    return;
  }
  const blob = new Blob([srt], { type: "application/x-subrip;charset=utf-8" });
  await downloadBlob(blob, `${safeFilename(currentPageTitleFallback() || "liusheng-subtitles")}.srt`);
  setMessage(t("srtExported"));
}

function buildSrtExportMetadata() {
  return {
    sourcePage: currentSrtSourcePageUrl(),
    exportedBy: "流声字幕 https://blog.liu-qi.cn/tools"
  };
}

function currentSrtSourcePageUrl() {
  const metadata = currentTranscript?.metadata && typeof currentTranscript.metadata === "object" ? currentTranscript.metadata : {};
  return String(metadata.pageUrl || currentSubtitleCacheEntry?.pageUrl || activeTab?.url || "").trim();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function importSubtitleFile() {
  const file = elements.subtitleImportFile.files?.[0];
  elements.subtitleImportFile.value = "";
  if (!file) {
    return;
  }
  try {
    const parsed = FuguangSubtitleFormat.parseSubtitleImportText(await file.text(), {
      filename: file.name,
      mimeType: file.type
    });
    const transcript = parsed.transcript;
    const cues = cuesFromTranscript(transcript);
    if (!cues.length) {
      throw new Error(t("importNoSubtitle"));
    }
    const entry = await buildSubtitleCacheEntry(transcript, parsed.metadata || {});
    if (!entry.id) {
      throw new Error(t("importNoContext"));
    }
    await putSubtitleCacheEntry(entry);
    currentSubtitleCacheEntry = entry;
    currentTranscript = transcript;
    subtitleCues = cues;
    subtitleCueSource = "transcript";
    renderedSubtitleJobId = entry.jobId || `imported-${Date.now()}`;
    renderedSubtitleSignature = `${entry.id}:${cues.length}`;
    markManualSubtitleOverride(renderedSubtitleSignature);
    activeCueIndex = -1;
    renderSubtitleCueList();
    await attachCurrentSubtitlesToPage();
    startSubtitleFollow();
    setMessage(t("importDone", { format: formatImportedSubtitleType(parsed.format) }));
  } catch (error) {
    setMessage(t("importFailed", { error: formatRuntimeError(error.message) }));
  }
}

function formatImportedSubtitleType(format) {
  return {
    json: t("fuguangJson"),
    srt: "SRT",
    vtt: "VTT",
    ass: "ASS",
    ssa: "SSA"
  }[format] || t("subtitleGeneric");
}

async function clearCurrentSubtitleCache() {
  try {
    const ids = new Set();
    const currentPageKey = await buildSubtitleCacheKeyForCurrentPage();
    if (currentPageKey) {
      ids.add(currentPageKey);
    }
    for (const matchingKey of await buildMatchingSubtitleCacheKeysForCurrentPage()) {
      ids.add(matchingKey);
    }
    if (cachedSubtitleLoadedKey) {
      ids.add(cachedSubtitleLoadedKey);
    }
    if (currentSubtitleCacheEntry?.id) {
      ids.add(currentSubtitleCacheEntry.id);
    }
    const cacheIds = [...ids].filter(Boolean);
    const shouldClearDisplay = shouldClearCurrentSubtitleDisplayForCacheAction();
    if (!cacheIds.length) {
      if (shouldClearDisplay) {
        const suppressError = await clearDisplayedSubtitleStateForCacheAction();
        setMessage(suppressError
          ? t("subtitleCacheDisplayClearedBackendFailed", { error: suppressError })
          : t("subtitleCacheDisplayCleared"));
      } else {
        setMessage(t("noCacheLocation"));
      }
      return;
    }

    const wasShowingClearedCache =
      Boolean(cachedSubtitleLoadedKey && ids.has(cachedSubtitleLoadedKey)) ||
      Boolean(currentSubtitleCacheEntry?.id && ids.has(currentSubtitleCacheEntry.id)) ||
      String(renderedSubtitleJobId || "").startsWith("cache-");
    const deleted = await deleteSubtitleCacheEntries(cacheIds);
    if (currentSubtitleCacheEntry?.id && ids.has(currentSubtitleCacheEntry.id)) {
      currentSubtitleCacheEntry = null;
    }
    if (cachedSubtitleLoadedKey && ids.has(cachedSubtitleLoadedKey)) {
      cachedSubtitleLoadedKey = "";
    }

    if (!deleted && !wasShowingClearedCache && !shouldClearDisplay) {
      renderSubtitleNotice();
      setMessage(t("noSavedSubtitleCache"));
      return;
    }
    let suppressError = "";
    if (wasShowingClearedCache || shouldClearDisplay) {
      suppressError = await clearDisplayedSubtitleStateForCacheAction();
    } else {
      renderSubtitleNotice();
    }
    if (suppressError) {
      setMessage(t("subtitleCacheClearedBackendFailed", { count: deleted, error: suppressError }));
    } else if (deleted) {
      setMessage(t("subtitleCacheClearedCount", { count: deleted }));
    } else {
      setMessage(t("subtitleCacheDisplayCleared"));
    }
  } catch (error) {
    setMessage(t("subtitleCacheClearFailed", { error: formatRuntimeError(error.message) }));
  }
}

function shouldClearCurrentSubtitleDisplayForCacheAction() {
  if (!subtitleCues.length && !currentTranscript && !renderedSubtitleJobId) {
    return false;
  }
  return true;
}

async function clearDisplayedSubtitleStateForCacheAction() {
  let suppressError = "";
  const jobIdToSuppress = currentJobId || renderedSubtitleJobId || currentSubtitleCacheEntry?.jobId || "";
  if (jobIdToSuppress && !isRunningJob(currentJob)) {
    clearedSubtitleJobIds.add(jobIdToSuppress);
    try {
      await suppressPreloadSubtitleState(jobIdToSuppress);
    } catch (error) {
      suppressError = formatRuntimeError(error.message);
    }
  }
  await detachCurrentSubtitlesFromPage();
  clearSubtitles(t("subtitleCacheCleared"));
  return suppressError;
}

function isSubtitleJobCleared(jobId) {
  return Boolean(jobId && clearedSubtitleJobIds.has(String(jobId)));
}

async function suppressPreloadSubtitleState(jobId) {
  if (!activeTab?.id || !jobId) {
    return;
  }
  const response = await send({
    type: MESSAGE.CLEAR_PRELOAD_SUBTITLE_STATE,
    tabId: activeTab.id,
    jobId
  });
  if (!response.ok) {
    throw new Error(response.error || t("backgroundClearFailed"));
  }
}

async function tryLoadCachedSubtitleForCurrentPage() {
  if (cacheAutoLoadInFlight || currentJobId) {
    return;
  }
  if (subtitleCues.length) {
    startSubtitleFollow();
    await ensureCurrentSubtitlesAttachedToPage();
    return;
  }
  const requestTabKey = activeTabKey(activeTab);
  const requestLoadId = subtitleLoadRequestId;
  cacheAutoLoadInFlight = true;
  try {
    await pruneSubtitleCache();
    if (!shouldApplyCachedSubtitleLoad(requestTabKey, requestLoadId)) {
      return;
    }
    const { key, entry } = await getSubtitleCacheEntryForCurrentPage();
    if (!shouldApplyCachedSubtitleLoad(requestTabKey, requestLoadId)) {
      return;
    }
    if (!key) {
      await detachStalePageSubtitlesWithoutCache();
      return;
    }
    if (!entry?.transcript) {
      await detachStalePageSubtitlesWithoutCache();
      return;
    }
    const cues = cuesFromTranscript(entry.transcript);
    if (!cues.length) {
      await detachStalePageSubtitlesWithoutCache();
      return;
    }
    if (!shouldApplyCachedSubtitleLoad(requestTabKey, requestLoadId)) {
      return;
    }
    cachedSubtitleLoadedKey = key;
    currentSubtitleCacheEntry = entry;
    currentTranscript = entry.transcript;
    subtitleCues = cues;
    subtitleCueSource = "transcript";
    renderedSubtitleJobId = entry.jobId || `cache-${key}`;
    renderedSubtitleSignature = `${key}:${cues.length}`;
    activeCueIndex = -1;
    renderSubtitleCueList();
    await ensureCurrentSubtitlesAttachedToPage();
    startSubtitleFollow();
  } finally {
    cacheAutoLoadInFlight = false;
  }
}

function shouldApplyCachedSubtitleLoad(requestTabKey, requestLoadId) {
  return Boolean(
    requestTabKey &&
    activeTabKey(activeTab) === requestTabKey &&
    subtitleLoadRequestId === requestLoadId &&
    !currentJobId &&
    !subtitleCues.length
  );
}

async function detachStalePageSubtitlesWithoutCache() {
  if (!activeTab?.id || currentJobId || subtitleCues.length) {
    return;
  }
  await detachCurrentSubtitlesFromPage();
}

async function buildSubtitleCacheEntry(transcript, importedPayload = {}) {
  const metadata = transcript?.metadata && typeof transcript.metadata === "object" ? transcript.metadata : {};
  const payload = { ...metadata, ...importedPayload };
  const context = currentSubtitleCacheContext(payload);
  const selected = getSelectedCandidate();
  const pageUrl = normalizeCacheUrl(context.pageUrl);
  const title = payload.title || currentPageTitleFallback(payload) || selected?.title || "";
  const sourceUrl = normalizeMediaCacheUrl(context.sourceUrl);
  const id = await buildSubtitleCacheKey({ pageUrl, sourceUrl });
  return {
    id,
    pageUrl,
    title,
    sourceUrl,
    jobId: payload.jobId || renderedSubtitleJobId || currentJobId || "",
    transcript,
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    segmentCount: Math.max(transcript.source?.length || 0, transcript.translated?.length || 0),
    approxBytes: JSON.stringify(transcript).length
  };
}

async function buildSubtitleCacheKeyForCurrentPage() {
  return buildSubtitleCacheKey(currentSubtitleCacheContext());
}

async function buildSubtitleCacheKey({ pageUrl = "", sourceUrl = "" }) {
  const normalizedPage = normalizeCacheUrl(pageUrl);
  const normalizedSource = normalizeMediaCacheUrl(sourceUrl);
  const seed = subtitleCacheSeed(normalizedPage, normalizedSource);
  if (!seed) {
    return "";
  }
  return `subtitle:v${SUBTITLE_CACHE_SCHEMA_VERSION}:${await sha256Text(seed)}`;
}

function currentSubtitleCacheContext(payload = {}) {
  const selected = getSelectedCandidate();
  return {
    pageUrl: payload.pageUrl || activeTab?.url || selected?.pageUrl || "",
    sourceUrl: payload.sourceUrl || selected?.url || currentJob?.sourceUrl || ""
  };
}

async function getSubtitleCacheEntryForCurrentPage() {
  const context = currentSubtitleCacheContext();
  const key = await buildSubtitleCacheKey(context);
  const entry = key ? await getSubtitleCacheEntry(key) : null;
  if (subtitleCacheEntryMatchesContext(entry, context) && subtitleCacheEntryHasDisplayableCues(entry)) {
    return { key, entry };
  }
  for (const legacyKey of await buildLegacySubtitleCacheKeys(context)) {
    const legacyEntry = await getSubtitleCacheEntry(legacyKey);
    if (subtitleCacheEntryMatchesContext(legacyEntry, context) && subtitleCacheEntryHasDisplayableCues(legacyEntry)) {
      return { key: legacyKey, entry: legacyEntry };
    }
  }
  const pageMatched = await findSubtitleCacheEntryByPageContext(context);
  if (pageMatched) {
    return pageMatched;
  }
  return { key, entry: null };
}

async function buildMatchingSubtitleCacheKeysForCurrentPage() {
  const context = currentSubtitleCacheContext();
  const keys = new Set();
  for (const legacyKey of await buildLegacySubtitleCacheKeys(context)) {
    const entry = await getSubtitleCacheEntry(legacyKey);
    if (subtitleCacheEntryMatchesContext(entry, context)) {
      keys.add(legacyKey);
    }
  }
  for (const entry of await getSubtitleCacheEntriesMatchingPageContext(context, { includeUnsafeForClear: true })) {
    if (entry?.id) {
      keys.add(entry.id);
    }
  }
  return [...keys];
}

async function buildLegacySubtitleCacheKeys({ pageUrl = "", sourceUrl = "" }) {
  const normalizedPage = normalizeCacheUrl(pageUrl);
  const normalizedSource = normalizeMediaCacheUrl(sourceUrl);
  const keys = [];
  const strictSeed = normalizedPage && normalizedSource
    ? subtitleCacheSeed(normalizedPage, normalizedSource)
    : "";
  if (strictSeed) {
    keys.push(`subtitle:v${SUBTITLE_CACHE_STRICT_LEGACY_SCHEMA_VERSION}:${await sha256Text(strictSeed)}`);
  }
  if (canUsePageOnlySubtitleCacheFallback(normalizedPage)) {
    return keys;
  }
  const seeds = [...new Set([normalizedPage, normalizedSource].filter(Boolean))];
  for (const seed of seeds) {
    keys.push(`subtitle:v${SUBTITLE_CACHE_LEGACY_SCHEMA_VERSION}:${await sha256Text(seed)}`);
  }
  return keys;
}

async function findSubtitleCacheEntryByPageContext(context) {
  const entry = (await getSubtitleCacheEntriesMatchingPageContext(context))
    .find(subtitleCacheEntryHasDisplayableCues);
  return entry?.id ? { key: entry.id, entry } : null;
}

async function getSubtitleCacheEntriesMatchingPageContext(context, { includeUnsafeForClear = false } = {}) {
  const currentPage = normalizeCacheUrl(context.pageUrl);
  if (!currentPage) {
    return [];
  }
  return (await getAllSubtitleCacheEntries())
    .filter(entry => includeUnsafeForClear
      ? subtitleCacheEntryMatchesPageForClear(entry, currentPage)
      : subtitleCacheEntryMatchesPageIdentity(entry, currentPage))
    .sort((left, right) => subtitleCacheEntryTime(right) - subtitleCacheEntryTime(left));
}

function subtitleCacheEntryMatchesPageIdentity(entry, normalizedPage) {
  return Boolean(
    entry?.id &&
    entry?.transcript &&
    subtitleCacheEntryHasCurrentSchema(entry) &&
    normalizedPage &&
    normalizeCacheUrl(entry.pageUrl) === normalizedPage &&
    subtitleCacheEntryMetadataPageMatches(entry, normalizedPage)
  );
}

function subtitleCacheEntryMetadataPageMatches(entry, normalizedPage) {
  const metadata = entry?.transcript?.metadata;
  if (!metadata || typeof metadata !== "object") {
    return true;
  }
  const metadataPage = normalizeCacheUrl(metadata.pageUrl || metadata.url || "");
  return !metadataPage || metadataPage === normalizedPage;
}

function subtitleCacheEntryHasDisplayableCues(entry) {
  return Boolean(entry?.transcript && transcriptHasDisplayableCues(entry.transcript, subtitleDisplayMode, {
    allowRunningSourcePreview: false
  }));
}

function subtitleCacheEntryHasCurrentSchema(entry) {
  return String(entry?.id || "").startsWith(`subtitle:v${SUBTITLE_CACHE_SCHEMA_VERSION}:`);
}

function subtitleSignature(jobId, job) {
  if (!jobId) {
    return "";
  }
  const translation = job?.translation || job?.progress?.translation || {};
  const progress = job?.progress || {};
  const segmentCount = Number(translation.segmentCount || 0);
  const chunksDone = Number(translation.chunksDone || progress.chunksDone || 0);
  const chunksFailed = Number(translation.chunksFailed || progress.chunksFailed || 0);
  const base = `${jobId}:${segmentCount}:${chunksDone}:${chunksFailed}`;
  const contentVersion = subtitleContentVersion(translation);
  return contentVersion ? `${base}:${contentVersion}` : "";
}

function subtitleContentVersion(translation = {}) {
  for (const key of ["vttSignature", "transcriptHash", "contentHash"]) {
    const value = String(translation?.[key] || "").trim();
    if (value) {
      return `${key}:${value}`;
    }
  }
  if (translation.vttText) {
    return `vtt:${textContentSignature(translation.vttText)}`;
  }
  if (translation.transcript) {
    return `transcript:${textContentSignature(JSON.stringify(translation.transcript))}`;
  }
  return "";
}

function textContentSignature(value) {
  const text = String(value || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return `${text.length}:${Math.abs(hash)}`;
}

function safeFilename(value) {
  const text = String(value || "liusheng-subtitles")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return (text || "liusheng-subtitles").slice(0, 80);
}

function showTab(tab) {
  const task = tab === "task";
  elements.tabTask.classList.toggle("active", task);
  elements.tabSettings.classList.toggle("active", !task);
  elements.tabTask.setAttribute("aria-selected", String(task));
  elements.tabSettings.setAttribute("aria-selected", String(!task));
  elements.taskPanel.classList.toggle("active", task);
  elements.settingsPanel.classList.toggle("active", !task);
}

function statusLabel(status) {
  const preloadStatus = status?.preloadJob?.status || status?.preload;
  const preloadStage = status?.preloadJob?.stage;
  if (preloadStage === "completed_with_warnings") {
    return t("statusCompletedWarnings");
  }
  if (preloadStatus === "done" || preloadStatus === "completed") {
    return t("statusCompleted");
  }
  if (preloadStatus === "error" || preloadStatus === "failed") {
    return t("statusFailed");
  }
  if (preloadStatus === "cancelled") {
    return t("statusCancelled");
  }
  if (preloadStatus && preloadStatus !== "idle") {
    return t("statusRunning");
  }
  return t("statusIdle");
}

function formatRole(role) {
  return {
    audio: t("roleAudio"),
    video: t("roleVideo"),
    playlist: t("rolePlaylist")
  }[role] || t("roleMedia");
}

function formatSource(source) {
  return {
    "request-headers": t("sourceRequestHeaders"),
    request: t("sourceRequest"),
    response: t("sourceResponse"),
    page: t("sourcePage"),
    "media-element": t("sourceMediaElement"),
    "json-parse": t("sourceJsonParse"),
    "hls-parse": t("sourceHlsParse"),
    "dash-parse": t("sourceDashParse")
  }[source] || source || "";
}

function jobTitle(job) {
  if (job.stage === "completed_with_warnings") {
    return t("statusCompletedWarnings");
  }
  if (job.status === "done" || job.status === "completed") {
    return t("statusCompleted");
  }
  if (job.status === "error" || job.status === "failed") {
    return t("statusFailed");
  }
  if (job.status === "cancelled") {
    return t("statusCancelled");
  }
  if (job.stage === "extracting_translating") {
    return t("jobExtractingTranslating");
  }
  if (job.stage === "asr_translation") {
    return t("jobAsrTranslation");
  }
  if (job.stage === "retry_failed") {
    return t("jobRetryFailed");
  }
  if (job.stage === "retry_translation") {
    return t("retranslateOnlyMessage");
  }
  return t("jobPreloading");
}

function stageLabel(stage) {
  return {
    queued: t("stageQueued"),
    extracting: t("stageExtracting"),
    extracting_translating: t("stageExtractingTranslating"),
    asr: t("stageAsr"),
    asr_translation: t("stageAsrTranslation"),
    retry_failed: t("stageRetryFailed"),
    retry_translation: t("stageRetryTranslation"),
    translating: t("stageTranslating"),
    translation: t("stageTranslating"),
    translated: t("stageTranslated"),
    completed: t("stageCompleted"),
    completed_with_warnings: t("statusCompletedWarnings"),
    cancelled: t("stageCancelled"),
    failed: t("stageFailed"),
    done: t("stageCompleted"),
    error: t("stageFailed")
  }[stage] || t("stageProcessing");
}

function stageClassName(stage) {
  return String(stage || "unknown").toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || "unknown";
}

function chunkStageLabel(stage) {
  return {
    queued: t("chunkQueued"),
    asr: t("chunkAsr"),
    asr_done: t("chunkAsrDone"),
    translation: t("chunkTranslation"),
    completed: t("chunkCompleted"),
    completed_with_warnings: t("chunkPartial"),
    done: t("chunkCompleted"),
    failed: t("chunkFailed"),
    cancelled: t("chunkStopped")
  }[stage] || t("chunkQueued");
}

function chunkMetaText(status) {
  const sourceSegments = status.sourceSegments || status.source_segments;
  const translatedSegments = status.translatedSegments || status.translated_segments;
  const parts = [];
  const message = String(status.message || "").trim();
  if (status.attempts) {
    parts.push(t("attemptCount", { count: status.attempts }));
  }
  if (status.stage === "done" && !sourceSegments && !translatedSegments) {
    parts.push(t("noSpeech"));
  }
  if (sourceSegments) {
    parts.push(t("sourceSegments", { count: sourceSegments }));
  }
  if (translatedSegments) {
    parts.push(t("translatedSegments", { count: translatedSegments }));
  }
  const asrFailures = Number(status.asrFailures || status.asr_failures || 0);
  if (asrFailures > 0) {
    parts.push(t("asrFailures", { count: asrFailures }));
  }
  if (!sourceSegments && status.sourceCount) {
    parts.push(t("sourceSegments", { count: status.sourceCount }));
  }
  if (!translatedSegments && status.translatedCount) {
    parts.push(t("translatedSegments", { count: status.translatedCount }));
  }
  if (message) {
    const duplicateMessage = parts.some(part => part === message);
    if (!duplicateMessage) {
      parts.push(message);
    }
  }
  const waiting = runningChunkWaitText(status);
  if (waiting) {
    parts.push(waiting);
  }
  return parts.join(" · ");
}

function runningChunkWaitText(status) {
  if (!["asr", "translation"].includes(status?.stage)) {
    return "";
  }
  const startedAt = Number(status.stageStartedAt || 0);
  if (!Number.isFinite(startedAt) || startedAt <= 0) {
    return "";
  }
  return t("waitingDuration", { duration: formatDuration((Date.now() - startedAt) / 1000) });
}

function waitingFirstChunkText(job) {
  const progress = job?.progress || {};
  const extraction = progress.extraction || job?.extract || {};
  const funAsrJob = isFunAsrJob(job);
  const parts = [];
  const activity = extractionActivityText(extraction);
  if (activity && activity !== "-") {
    parts.push(activity);
  } else {
    parts.push(t(funAsrJob ? "waitingFirstLongFileChunk" : "waitingFirstChunk"));
  }
  const elapsed = Number(progress.elapsedSeconds || extraction.elapsedSeconds || 0) || 0;
  if (elapsed > 0) {
    parts.push(t("waitingDuration", { duration: formatDuration(elapsed) }));
  }
  const readySeconds = Number(extraction.readySeconds || 0) || 0;
  if (readySeconds > 0) {
    parts.push(t("readyAudio", { duration: formatDuration(readySeconds) }));
  }
  return `${parts.join(" · ")}。`;
}

function extractionActivityText(extraction) {
  if (!extraction) {
    return "-";
  }
  const status = extraction.status || extraction.phase;
  if (status === "done" || status === "completed") {
    return t("stageCompleted");
  }
  if (status === "error" || status === "failed") {
    return t("stageFailed");
  }
  if (extraction.message) {
    return shorten(extraction.message, 34);
  }
  const done = Number(extraction.internalChunksDone || 0) || 0;
  const total = Number(extraction.internalChunksTotal || 0) || 0;
  if (total) {
    return t("internalChunks", { done, total });
  }
  const downloaded = Number(extraction.downloadedSegments || 0) || 0;
  const segmentTotal = Number(extraction.totalSegments || 0) || 0;
  if (segmentTotal) {
    return t("downloadSegments", { done: downloaded, total: segmentTotal });
  }
  return "-";
}

function friendlyChunkError(error) {
  const text = String(error || "");
  if (!text) {
    return "";
  }
  if (text.includes("自动修复也失败") || text.includes("Expecting value") || text.includes("Expecting ',' delimiter")) {
    return t("jsonError");
  }
  if (text.includes("没有可用字幕")) {
    return t("noSubtitleItems");
  }
  return shorten(text, 120);
}

function updateActionButtons(job) {
  const running = isRunningJob(job);
  const retryableAsrFailures = countRetryableAsrFailureChunks(job);
  const sourceChunks = countReusableSourceChunks(job);
  const cachedSourceChunks = job ? 0 : transcriptReusableSourceCount(currentTranscript);
  const audioChunks = countReusableAudioChunks(job);
  const canResumeAudio = audioChunks > 0 && !sourceChunks;
  const canResumeTranslation = countContinuableTranslationChunks(job) > 0;
  const canRetryPreload = retryableAsrFailures > 0 || canResumeAudio || canResumeTranslation;
  const audioCacheRemoved = Boolean(job?.audioCacheRemoved);
  const continueNeedsAudio = retryableAsrFailures > 0 || canResumeAudio;
  const continueBlockedByAudio = audioCacheRemoved && continueNeedsAudio && !canResumeTranslation;
  elements.startPreload.disabled = startRequestInFlight || running;
  elements.startPreload.textContent = job ? t("restartExtract") : t("startExtract");
  elements.startPreload.title = job ? t("restartTitle") : t("startTitle");
  elements.rerunAsr.textContent = t("rerunAsr");
  elements.rerunAsr.title = audioCacheRemoved || audioChunks <= 0
    ? t("rerunAsrNeedsAudioTitle")
    : t("rerunAsrTitle");
  elements.rerunAsr.disabled = asrRetryRequestInFlight || !job || running || audioCacheRemoved || audioChunks <= 0;
  elements.retryPreload.textContent = t("continueTask");
  elements.retryPreload.title = continueBlockedByAudio
    ? t("retryNeedsExtractTitle")
    : t("continueTaskTitle");
  elements.retryPreload.disabled = retryRequestInFlight || !job || running || continueBlockedByAudio || !canRetryPreload;
  elements.retryTranslation.textContent = t("retranslate");
  elements.retryTranslation.title = cachedSourceChunks > 0 ? t("continueTranslateTitle") : t("retranslateTitle");
  elements.retryTranslation.disabled = translationRetryRequestInFlight || running || (sourceChunks + cachedSourceChunks) <= 0;
  elements.cancelPreload.disabled = !running;
  elements.clearAudioCache.disabled = !job || running;
  elements.clearAudioCache.textContent = t("clearAudio");
  elements.clearAudioCache.title = running
    ? t("clearAudioRunningTitle")
    : audioCacheRemoved
      ? t("clearAudioAgainTitle")
      : t("clearAudioTitle");
  elements.clearSubtitleCache.disabled = !canClearCurrentSubtitleCache(job);
  elements.subtitleEditToggle.disabled = subtitleEditButtonShouldBeDisabled(job);
}

function canClearCurrentSubtitleCache(job) {
  return (
    Boolean(currentSubtitleCacheEntry?.id) ||
    Boolean(cachedSubtitleLoadedKey) ||
    Boolean(currentTranscript) ||
    subtitleCues.length > 0 ||
    jobHasClearableSubtitleState(job)
  );
}

function jobHasClearableSubtitleState(job) {
  const translation = job?.translation || job?.progress?.translation || {};
  const transcript = translation.transcript;
  return Boolean(
    translation.vttText ||
    translation.vttPath ||
    Number(translation.segmentCount || 0) > 0 ||
    Number(translation.sourceSegments || 0) > 0 ||
    Number(translation.translatedSegments || 0) > 0 ||
    transcriptHasClearableSubtitleState(transcript)
  );
}

function transcriptHasClearableSubtitleState(transcript) {
  return Boolean(
    transcript &&
    (
      transcriptReusableSourceCount(transcript) > 0 ||
      (Array.isArray(transcript.translated) && transcript.translated.some(segment => cleanSubtitleText(segment?.text || "")))
    )
  );
}

function countReusableSourceChunks(job) {
  const direct = Number(job?.reusableSourceChunks || job?.translation?.reusableSourceChunks || job?.progress?.translation?.reusableSourceChunks || 0);
  if (direct > 0) {
    return direct;
  }
  const statuses = job?.translation?.chunkStatuses || job?.progress?.chunkStatuses || [];
  if (Array.isArray(statuses)) {
    const count = statuses.filter(chunkHasReusableSource).length;
    if (count) {
      return count;
    }
  }
  const sourceSegments = Number(job?.translation?.sourceSegments || job?.progress?.sourceSegments || 0);
  return sourceSegments > 0 ? 1 : 0;
}

function countReusableAudioChunks(job) {
  const direct = Number(job?.reusableAudioChunks || job?.translation?.reusableAudioChunks || job?.progress?.translation?.reusableAudioChunks || 0);
  if (direct > 0) {
    return direct;
  }
  const total = Number(job?.translation?.chunksTotal || job?.progress?.translation?.chunksTotal || job?.progress?.chunksTotal || 0);
  const extractDone = job?.extract?.status === "completed" || job?.progress?.extraction?.status === "completed";
  return extractDone && total > 0 ? total : 0;
}

function countContinuableTranslationChunks(job) {
  const statuses = job?.translation?.chunkStatuses || job?.progress?.chunkStatuses || job?.progress?.translation?.chunkStatuses || [];
  if (!Array.isArray(statuses) || !statuses.length) {
    return 0;
  }
  return statuses.filter(status => {
    if (!chunkHasReusableSource(status) || chunkNeedsAsrRetry(status)) {
      return false;
    }
    if (status?.stage === "failed") {
      return true;
    }
    return status?.stage === "completed_with_warnings" && Number(status?.translationFailures || 0) > 0;
  }).length;
}

function countRetryableAsrFailureChunks(job) {
  const statuses = job?.translation?.chunkStatuses || job?.progress?.chunkStatuses || job?.progress?.translation?.chunkStatuses || [];
  if (Array.isArray(statuses) && statuses.length) {
    return statuses.filter(status => {
      if (chunkNeedsAsrRetry(status)) {
        return true;
      }
      return status?.stage === "failed" && !chunkHasReusableSource(status);
    }).length;
  }
  const asrPartialFailed = Number(job?.translation?.chunksAsrPartialFailed || job?.progress?.translation?.chunksAsrPartialFailed || 0);
  if (asrPartialFailed > 0) {
    return asrPartialFailed;
  }
  const failed = Number(job?.translation?.chunksFailed || job?.progress?.chunksFailed || 0);
  return failed > 0 && countReusableSourceChunks(job) <= 0 ? failed : 0;
}

function isRunningJob(job) {
  if (!job) {
    return false;
  }
  return !["done", "completed", "error", "failed", "cancelled"].includes(job.status);
}

function extractionProgressText(progress, status) {
  if (status === "error" || status === "failed") {
    return t("stageFailed");
  }
  if (progress?.status === "done" || progress?.status === "completed") {
    return t("completedPercent");
  }
  if (progress?.message && Number.isFinite(Number(progress?.percent))) {
    return `${Number(progress.percent).toFixed(1)}% · ${shorten(progress.message, 24)}`;
  }
  if (Number.isFinite(Number(progress?.percent))) {
    return `${Number(progress.percent).toFixed(1)}%`;
  }
  return stageLabel(progress?.stage || status);
}

function translationProgressText(translation, job = null) {
  const total = translation?.chunksTotal || 0;
  const done = translation?.chunksDone || 0;
  const active = (translation?.chunksAsr || 0) + (translation?.chunksTranslating || 0);
  const failed = translation?.chunksFailed || 0;
  if (!total) {
    return t(isFunAsrJob(job) ? "waitFirstLongFileSegment" : "waitFirstSegment");
  }
  const parts = [`${done}/${total}`];
  if (active) {
    parts.push(t("activeProcessing", { count: active }));
  }
  if (failed) {
    parts.push(t("failedCount", { count: failed }));
  }
  return parts.join(" · ");
}

function normalizedPercent(percent, status) {
  if (status === "done" || status === "completed") {
    return 100;
  }
  if (status === "error" || status === "failed") {
    return 100;
  }
  const value = Number(percent);
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
}

function formatDuration(seconds) {
  const total = Math.round(Number(seconds));
  if (!Number.isFinite(total) || total <= 0) {
    return "";
  }
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

function formatElapsedSeconds(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${total}s`;
}

function shorten(value, max = 92) {
  const text = String(value || "");
  if (text.length <= max) {
    return text;
  }
  const head = Math.max(24, Math.floor(max * 0.52));
  const tail = Math.max(20, max - head - 3);
  return `${text.slice(0, head)}...${text.slice(-tail)}`;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

function clampSetting(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return clamp(number, min, max);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function setMessage(text = "") {
  setTaskMessage(text);
}

function setTaskMessage(text = "") {
  const value = String(text || "").trim();
  elements.taskMessage.textContent = value;
  elements.taskMessage.hidden = !value;
}

function setSettingsMessage(text = "") {
  elements.message.textContent = String(text || "").trim();
}

function clearCandidateEmptyTaskMessage() {
  const value = String(elements.taskMessage.textContent || "").trim();
  const emptyMessages = new Set([
    t("sourcesEmpty"),
    t("noCandidates"),
    I18N.zh.sourcesEmpty,
    I18N.zh.noCandidates,
    I18N.en.sourcesEmpty,
    I18N.en.noCandidates
  ]);
  if (emptyMessages.has(value)) {
    setTaskMessage("");
  }
}

function valueOrDefault(value, fallback) {
  return value === undefined || value === null || value === "" ? fallback : value;
}

function send(message) {
  return chrome.runtime.sendMessage(message).catch(error => ({
    ok: false,
    error: t("backendNoResponse", { error: formatRuntimeError(error.message) })
  }));
}

function formatRuntimeError(message = "") {
  const text = String(message || "").trim();
  if (/Extension context invalidated/i.test(text)) {
    return t("contextInvalidated");
  }
  if (/Receiving end does not exist/i.test(text)) {
    return t("receivingEndMissing");
  }
  if (/message port closed/i.test(text)) {
    return t("portClosed");
  }
  return text || t("unknownError");
}
