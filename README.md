# GPT API 插件

**简体中文** | [English](<README.en.md>)

在 DeepSeek Harness 对话中调用 GPT、文生图或参考图生图，并通过弹窗选择接口提供的模型。当前版本为 **1.2.0**。

## 安装

### 直接使用 GitHub 链接

1. 打开 DSH 侧栏的 **插件 → 添加插件**。
2. 粘贴以下仓库链接，点击 **安装**。无需手动克隆或构建。

```text
https://github.com/wildbyteai/dsh-gpt-api
```

3. 安装后打开 **插件 → GPT API**，填写自己的 API Key 和 API 基础地址。

仓库不包含 API Key。OpenAI 官方 Key 使用官方地址；中转服务的 Key 应使用该服务提供的地址。

### 命令行安装

```bash
dsh plugin --profile desktop add "github:wildbyteai/dsh-gpt-api"
```

[参考图生图](#参考图生图) · [参数说明](#参数说明) · [结果与用量](#结果与用量) · [常见问题](#常见问题)

## 配置与使用

1. 在插件配置页填写 Key 与 API 地址，保存配置。基础地址需包含 `/v1` 等 API 前缀，插件自行追加具体接口路径。
2. 在 **文本模型** 或 **图片模型** 旁点击 **获取模型**。
3. 在弹窗中搜索并选中模型，点击 **保存更改**。
4. 在对话中说明要使用 GPT API：

```text
调用 GPT，帮我审查这段代码，指出可能的 bug。
用 GPT 生图：一只在窗边晒太阳的橘猫，水彩风格，正方形。
检查 GPT API 连接并列出可用模型。
```

获取模型前会保存当前接口配置。弹窗支持搜索、加载提示、空列表和错误重试；按 Escape 关闭时取消请求。图片相关名称优先排序，列表仍保留接口返回的全部模型。

### 默认配置

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| API 基础地址 | `https://api.openai.com/v1` | 也支持兼容 OpenAI 的服务地址。 |
| 文本模型 | `gpt-6.1-sol` | 按提供方实际支持的模型选择。 |
| 生图模型 | `gpt-image-2.6-flare` | 提供方需支持对应图片接口。 |
| 文本接口 | `responses` | 可选择 `chat-completions`。 |
| 请求超时 | `180000` 毫秒 | 可设置 1000–600000 毫秒。 |
| 密钥引用 | `DSH_GPT_API_KEY` | Key 通过 DSH 凭据服务保存。 |

已手动保存的模型选择优先于默认值。模型名称出现在列表中，并不代表提供方支持它的全部能力。

远程接口使用 HTTPS；本机服务支持 HTTP。基础地址不应包含用户名、密码、查询参数或片段。模型选择弹窗的获取请求另有 30 秒上限。

## 参考图生图

### 准备图片

把参考图放到当前会话工作区内。文件夹名称没有限制，以下只是目录示意：

```text
工作区/
├── assets/
│   ├── subject.png
│   └── style.webp
└── output/
    └── gpt-api/       # 自动保存生成结果
```

- 支持 PNG、JPEG 和 WebP，最多 10 张，每张不超过 30 MiB。
- 相对路径按当前对话工作目录解析；也接受工作区内的绝对路径。
- 对话附件须先保存到工作区，再使用对应文件路径。
- 网络图片先下载到工作区；`reference_images` 接收本地文件路径，不接收 URL、Base64 或文件 ID。
- 图片内容会上传给配置的 API 提供方。原图保持不变，结果另存。

### 单图参考

在对话中直接描述素材和修改目标：

```text
用 GPT 生图，参考 assets/subject.png。
保留主体和构图，把背景换成海边，输出横版图片。
```

对应工具调用示例：

```js
gpt_image({
  prompt: "保留参考图的主体和构图，把背景换成海边",
  reference_images: ["assets/subject.png"],
  size: "1536x1024",
  quality: "high"
})
```

### 多图参考

说明每张图的用途，例如主体与风格：

```text
用 GPT 生图：assets/subject.png 作为主体参考，assets/style.webp 作为配色和风格参考。
保持第一张图的主体特征，采用第二张图的配色，生成一张正方形产品图。
```

```js
gpt_image({
  prompt: "保持第一张参考图的主体特征，采用第二张参考图的配色和风格",
  reference_images: ["assets/subject.png", "assets/style.webp"],
  size: "1024x1024",
  output_format: "png",
  n: 1
})
```

有参考图时，实际图片文件通过 multipart 上传到 `/images/edits`；省略 `reference_images` 或传空数组时，使用 `/images/generations` 文生图。

提供方和所选模型须支持参考图编辑。当前工具按提示词进行整图生成或编辑，未暴露 `mask` 蒙版参数。主体、风格与构图的保留效果由模型决定。

## 对话工具

| 工具 | 用途 |
| --- | --- |
| `gpt_call` | 文本、代码、分析和翻译。只发送本次明确传入的提示词与上下文。 |
| `gpt_image` | 文生图或参考图生图，请求生成 1–4 张图片。 |
| `gpt_models` | 查询 `/models`，检查连接并获取模型列表，不发起生成请求。 |

通常直接在对话中描述任务即可，以下参数供指定生成选项或开发集成时参考。

## 参数说明

### `gpt_image`

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `prompt` | 必填 | 描述画面、修改目标和要保留的内容。 |
| `reference_images` | 无 | 最多 10 个工作区内的本地图片路径；省略或空数组走文生图。 |
| `model` | 配置页的生图模型 | 可针对本次调用覆盖。 |
| `size` | `auto` | 常用 `1024x1024`、`1536x1024`、`1024x1536`；其他尺寸以模型支持为准。 |
| `quality` | `auto` | `low`、`medium`、`high`、`xhigh`、`max` 或 `auto`；较高档位需模型支持。 |
| `output_format` | `png` | `png`、`jpeg` 或 `webp`。 |
| `n` | `1` | 请求数量，1–4 的整数；实际返回数量以提供方为准。 |

### `gpt_call`

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `prompt` | 必填 | 本次要交给 GPT 的任务。 |
| `context` | 无 | 明确选取的相关上下文；不自动上传整个会话。 |
| `instructions` | 无 | 本次调用的风格或行为说明。 |
| `model` | 配置页的文本模型 | 可针对本次调用覆盖。 |
| `max_output_tokens` | `4096` | 输出上限，1–32768 的整数。 |

`gpt_models()` 不接收参数。Chat Completions 模式使用 `max_completion_tokens`，兼容服务需支持该字段。图片接口使用 GPT Image 参数，未单独适配 DALL·E 专有参数。

## 结果与用量

生成图片保存在当前对话工作目录的 `output/gpt-api/`，使用唯一文件名，不覆盖已有文件。工具返回原图路径，并尝试附加预览。

返回结果的主要字段：

| 字段 | 含义 |
| --- | --- |
| `model` | 提供方返回的模型名称，或本次请求的模型。 |
| `files[].path` | 已保存原图的绝对路径。 |
| `files[].revised_prompt` | 提供方返回的改写提示词，或 `null`。 |
| `references[]` | 参考图的文件名与 SHA-256 摘要，用于核对上传素材。 |
| `usage` | 提供方返回的用量数据，或 `null`。 |

参考图文件内容只进入图片 API 请求；工具结果不包含参考图的完整 Base64。图片预览失败时，已保存的原图仍可通过返回路径查看。

API Key 由 DSH 凭据服务保存，配置页只查询是否已设置；密钥输入框留空保留当前 Key。工具不自动上传整段会话或工作区文件。

文本和生图计入所配置的 API 账号用量，ChatGPT 订阅与 API 额度分开。超时后不会自动重试；再次调用前先检查已有结果，避免重复生成。只读工作区会在生图请求前提示切换为可写模式。

## 升级

从 GitHub 安装的插件，在插件页面卸载后用同一链接重新安装，即可获取当前主干代码。刷新页面只更新页面显示，不会下载 GitHub 的新源码。

本地链接安装可在源码目录执行 `git pull --ff-only`，然后关闭并重新启用插件以触发重组；必要时重启 DSH。保留源码目录，链接安装会继续使用该目录的文件。

## 常见问题

| 现象 | 处理方式 |
| --- | --- |
| HTTP 401 | 检查 Key 是否有效、是否与 API 地址匹配；中转 Key 使用对应中转地址。 |
| `/images/edits` 返回 400 或 404 | 检查提供方是否支持 multipart 参考图编辑，以及当前生图模型是否正确。 |
| 未找到参考图片 | 检查文件是否已保存、路径是否相对于当前工作目录；网络图片或附件先保存到工作区。 |
| 提示参考图片在工作区外 | 把素材复制到当前会话工作区，重新指定工作区内路径。指向外部的符号链接也会被校验。 |
| 提示图片格式或大小错误 | 使用真实 PNG、JPEG 或 WebP 文件，每张不超过 30 MiB；仅修改后缀不会转换格式。 |
| 模型列表为空 | 检查提供方是否通过 `/models` 返回模型；弹窗显示真实结果，不填充示例模型。 |
| 请求超时 | 文本和生图超时可设为 1000–600000 毫秒；弹窗获取模型有 30 秒上限，重试需手动触发。 |
| 已安装但看不到新选项 | 从 GitHub 安装的版本先卸载重装；本地链接版本触发插件重组，再刷新页面或重启 DSH。 |

## 本地开发与测试

```bash
git clone https://github.com/wildbyteai/dsh-gpt-api.git
cd dsh-gpt-api
dsh plugin --profile desktop add "link:$(pwd)"
```

在具备插件所需 DSH 依赖的环境中运行：

```bash
node --test test/*.test.js
```

41 项本地测试通过，覆盖文本接口、模型选择、原生 RPC、参考图文件上传、图片保存、路径与大小校验、密钥脱敏、取消请求和默认模型。测试使用本地模拟 API，不产生生成费用；真实参考图生成效果和浏览器端完整验收尚未验证。

要求 Node.js 22 或更高。包声明的 DSH 版本范围为 `>=0.2.1-rc.5 <0.3.0`，具体依赖与安装兼容检查以 [package.json](<package.json>) 和 DSH 提示为准。

## 项目与许可

独立社区插件，参考 [OpenAI Developers](https://github.com/openai/plugins/tree/main/plugins/openai-developers) 的插件入口思路，并非 OpenAI 官方插件。

- [反馈问题](https://github.com/wildbyteai/dsh-gpt-api/issues)
- [MIT 许可](<LICENSE>)
- [OpenAI 图片生成文档](https://developers.openai.com/api/docs/guides/image-generation)
