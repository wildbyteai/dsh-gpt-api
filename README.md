# GPT API 插件

**简体中文** | [English](<README.en.md>)

在 DeepSeek Harness 对话中调用 GPT、生成图片，并通过弹窗选择模型。

## 安装

### 直接使用 GitHub 链接

1. 打开 DSH 侧栏的 **插件 → 添加插件**。
2. 粘贴以下链接，点击 **安装**。无需手动克隆或构建。

```text
https://github.com/wildbyteai/dsh-gpt-api
```

安装后，在 **插件 → GPT API** 配置自己的 API Key 和接口地址。

### 命令行安装

```bash
dsh plugin --profile desktop add "github:wildbyteai/dsh-gpt-api"
```

## 配置与使用

1. 打开 **插件 → GPT API**，填写 API Key 和 API 基础地址。
2. 在 **文本模型** 或 **图片模型** 旁点击 **获取模型**。
3. 在弹窗中搜索并选中模型，点击 **保存更改**。
4. 在对话中指定使用 GPT API：

```text
调用 GPT，帮我审查这段代码，指出可能的 bug。
用 GPT 生图：一只在窗边晒太阳的橘猫，水彩风格，正方形。
检查 GPT API 连接并列出可用模型。
```

获取模型前会保存当前接口配置。弹窗支持加载提示、搜索、错误重试和 Escape 关闭；关闭时取消请求。图片相关名称优先排序，但仍保留接口返回的全部模型。具体型号的能力以提供方为准。

### 默认配置

| 配置项 | 默认值 |
| --- | --- |
| API 基础地址 | `https://api.openai.com/v1` |
| 文本模型 | `gpt-6.1-sol` |
| 生图模型 | `gpt-image-2.6-flare` |
| 文本接口 | `responses` |
| 请求超时 | `180000` 毫秒 |
| 密钥引用 | `DSH_GPT_API_KEY` |

已手动保存的模型选择会优先于默认值。

兼容 OpenAI 的服务可使用自己的接口地址，包含 `/v1` 等 API 前缀。远程接口使用 HTTPS，本机服务支持 HTTP。文本接口可选择 `responses` 或 `chat-completions`。

## 参考图生图

1.2.0 支持使用本地参考图生成或修改图片。例如在对话中说：

```text
用 GPT 生图，参考工作区里的 assets/reference.png，保留主体和构图，把背景换成海边。
```

工具调用示例：

```js
gpt_image({
  prompt: "保留参考图的主体和构图，把背景换成海边",
  reference_images: ["assets/reference.png"],
  size: "1536x1024",
  quality: "high"
})
```

- 参考图须为当前会话工作区内的 PNG、JPEG 或 WebP 文件，最多 10 张，每张不超过 30 MiB。路径相对于当前对话工作目录解析，也支持工作区内的绝对路径。
- 对话附件须先保存到工作区，再使用对应文件路径。
- 有参考图时，图片文件内容通过 multipart 上传到 `/images/edits`；没有参考图时，仍使用 `/images/generations`。
- 原图保持不变，生成结果另存到 `output/gpt-api/`。提供方和所选模型须支持参考图编辑接口。

## 对话工具

| 工具 | 用途 |
| --- | --- |
| `gpt_call` | 文本、代码、分析和翻译。只发送本次传入的提示词与上下文。 |
| `gpt_image` | 生成 1–4 张图片，支持 PNG、JPEG 和 WebP。 |
| `gpt_models` | 查询 `/models`，检查连接并获取模型列表，不发起生成请求。 |

参数接口：

```js
gpt_call({ prompt, context, instructions, model, max_output_tokens })
gpt_image({ prompt, reference_images, model, size, quality, output_format, n })
gpt_models()
```

`gpt_call` 和 `gpt_image` 的 `prompt` 为必填参数，其余参数可选。文本输出上限默认为 4096 token，可设为 1–32768。生图尺寸与质量选项取决于所用型号。

### 图片与凭据

- 图片保存在当前对话工作目录的 `output/gpt-api/`，使用唯一文件名，保留已有文件。工具返回原图路径，并尝试附加预览。
- API Key 由 DSH 凭据服务保存。配置页只查询是否已设置，密钥输入框留空会保留当前 Key。仓库不包含密钥或个人环境文件。
- 工具不自动上传整段会话或工作区文件；模型列表请求的客户端参数也不包含 Key。
- 文本和生图计入所配置的 API 账号用量。ChatGPT 订阅与 API 额度分开。
- 超时后不会自动重试。只读工作区会在生图请求前提示切换为可写模式。

## 更新与常见问题

从 GitHub 安装的插件，更新时卸载后用同一链接重新安装。新界面尚未显示时刷新页面；必要时重启 DSH。

| 现象 | 检查项 |
| --- | --- |
| HTTP 401 | Key 是否有效，是否与 API 地址匹配；中转服务的 Key 应使用对应服务地址。 |
| HTTP 404 或未返回文本 | 检查模型 ID 和文本接口模式。 |
| 模型列表为空 | 提供方是否通过 `/models` 返回模型；弹窗显示真实结果，不填充示例模型。 |
| 请求较慢 | 超时可调整到 1000–600000 毫秒，重试需手动触发。 |

Chat Completions 模式使用 `max_completion_tokens`，兼容服务需支持该字段。图片接口使用 GPT Image 参数，未单独适配 DALL·E 专有参数。

## 本地开发与测试

```bash
git clone https://github.com/wildbyteai/dsh-gpt-api.git
cd dsh-gpt-api
dsh plugin --profile desktop add "link:$(pwd)"
```

链接安装需保留源码目录。在具备插件所需 DSH 依赖的环境中运行测试：

```bash
node --test test/*.test.js
```

41 项本地测试通过，覆盖文本接口、模型选择、原生 RPC、参考图文件上传、图片保存、大小与路径校验、密钥脱敏、取消请求和默认模型。测试使用本地模拟 API，不产生生成费用；真实参考图生成效果和浏览器端完整验收尚未验证。

测试依赖版本为 DSH `0.2.1-rc.5`，要求 Node.js 22 或更高。依赖版本与安装兼容声明见 [package.json](<package.json>)。

## 项目与许可

独立社区插件，参考 [OpenAI Developers](https://github.com/openai/plugins/tree/main/plugins/openai-developers) 的插件入口思路，并非 OpenAI 官方插件。

- [反馈问题](https://github.com/wildbyteai/dsh-gpt-api/issues)
- [MIT 许可](<LICENSE>)
- [OpenAI 图片生成文档](https://developers.openai.com/api/docs/guides/image-generation)
