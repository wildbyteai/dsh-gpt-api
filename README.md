# GPT API for DeepSeek Harness

在 DSH 对话中调用 GPT、生成图片，并从接口获取模型列表。Call GPT, generate images, and choose models from your API provider inside DSH.

## 直接链接安装 / Install from a GitHub link

**中文：** 打开 DSH 侧栏的 **插件 → 添加插件**，粘贴下面的仓库链接，然后点击 **安装**。普通安装无需手动克隆或构建。

**English:** Open **Plugins → Add plugin** in the DSH sidebar, paste this repository URL, then click **Install**. No manual cloning or build step is needed.

```text
https://github.com/wildbyteai/dsh-gpt-api
```

安装后，在 **GPT API** 配置页填写自己的 API Key。The plugin does not include an API key; set your own key on its configuration page.

也可以使用 CLI / You can also install from the CLI:

```bash
dsh plugin --profile desktop add "github:wildbyteai/dsh-gpt-api"
```

[中文说明](#中文) | [English](#english) | [开发与测试 / Development and tests](#开发与测试--development-and-tests)

## 默认配置 / Default settings

| 配置 / Setting | 默认值 / Default |
| --- | --- |
| API 基础地址 / API base URL | `https://api.openai.com/v1` |
| 文本模型 / Text model | `gpt-6.1-sol` |
| 生图模型 / Image model | `gpt-image-2.6-flare` |
| 文本接口 / Text API | `responses` |
| 请求超时 / Request timeout | `180000` ms |
| 密钥引用 / Credential reference | `DSH_GPT_API_KEY` |

修改默认型号会保留已经手动保存的模型设置。Changing the defaults leaves manually saved model selections unchanged.

## 中文

### 配置与使用

1. 安装后，在 **插件 → GPT API** 打开配置页。
2. 填写 API Key 和 API 基础地址。兼容 OpenAI 的服务可使用自己的地址，包含接口前缀，例如 `/v1`。远程地址使用 HTTPS，本机服务支持 HTTP。
3. 在 **文本模型** 或 **图片模型** 旁点击 **获取模型**。获取前会保存当前配置，再由 DSH Host 请求模型列表；Key 留在 Host，不进入模型列表请求的客户端参数。
4. 在弹窗中搜索模型名称，点击模型回填，然后点击 **保存更改**。弹窗支持加载提示、空列表、错误重试和 Escape 关闭；关闭时取消请求。图片相关名称优先排序，列表仍保留全部返回模型。
5. 在对话中指定使用 GPT API，例如：

```text
调用 GPT，帮我审查这段代码，指出可能的 bug。
用 GPT 生图：一只在窗边晒太阳的橘猫，水彩风格，正方形。
检查 GPT API 连接并列出可用模型。
```

模型列表只代表接口返回的模型名称。具体型号是否支持文本或生图，以提供方为准。

### 对话工具

| 工具 | 用途 |
| --- | --- |
| `gpt_call` | 文本、代码、分析和翻译。只发送本次明确传入的提示词与上下文。 |
| `gpt_image` | 生成 1–4 张图片，支持 PNG、JPEG 和 WebP。 |
| `gpt_models` | 请求 `/models`，检查连接并获取模型列表，不发起生成请求。 |

可选参数：

```js
gpt_call({ prompt, context, instructions, model, max_output_tokens })
gpt_image({ prompt, model, size, quality, output_format, n })
gpt_models()
```

`gpt_call` 的 `max_output_tokens` 默认为 4096，可设为 1–32768。生图尺寸和质量选项取决于所用型号。

### 图片、凭据与用量

- 图片写入当前对话工作目录的 `output/gpt-api/`，使用唯一文件名，保留已有文件；工具返回原图路径，并尝试附加图片预览。
- API Key 由 DSH 凭据服务保存，配置页只查询是否已设置。密钥输入框留空会保留当前 Key。公开仓库不含任何密钥或个人环境文件。
- 工具只发送传入的任务内容，不自动上传整段会话或工作区文件。
- 文本和生图计入所配置的 API 账号用量。ChatGPT 订阅与 API 额度分开。
- 请求超时后不会自动重试，避免重复生成与计费。只读工作区会在生图请求前提示切换为可写模式。

### 更新与常见问题

从 GitHub 安装的插件，更新时在插件页面卸载后重新用同一链接安装。最新界面尚未显示时，刷新页面；必要时重启 DSH。

| 现象 | 检查项 |
| --- | --- |
| HTTP 401 | Key 是否有效，是否与当前 API 地址匹配。中转服务的 Key 应使用对应服务地址。 |
| HTTP 404 或未返回文本 | 模型 ID 和文本接口模式是否正确。支持 `responses` 与 `chat-completions`。 |
| 模型列表为空 | 提供方是否通过 `/models` 返回模型；弹窗显示接口真实结果，不填充示例模型。 |
| 请求较慢 | 可将超时调整到 1000–600000 毫秒；重试需手动触发。 |

Chat Completions 模式使用 `max_completion_tokens`，兼容服务需支持该字段。图片接口使用 GPT Image 参数，未单独适配 DALL·E 专有参数。

## English

### Setup and use

1. After installation, open **Plugins → GPT API**.
2. Enter your API key and base URL. OpenAI-compatible providers can use their own URL, including the API prefix such as `/v1`. Remote endpoints require HTTPS; local services can use HTTP.
3. Click **Fetch models** next to **Text model** or **Image model**. Pending settings are saved first, and the DSH Host fetches the list. The key stays on the Host and is not included in the client's model-list request parameters.
4. Search the dialog and click a model to fill the field, then click **Save changes**. The dialog handles loading, empty lists, errors and explicit retries. Escape closes it and cancels the request. Image-related names are sorted first without hiding other returned models.
5. Ask for GPT API in a conversation:

```text
Use GPT API to review this code and identify potential bugs.
Use GPT API to generate a square watercolor image of an orange cat resting by a sunny window.
Check the GPT API connection and list available models.
```

The list contains model IDs returned by the endpoint. Support for text or image generation depends on the provider.

### Conversation tools

| Tool | Purpose |
| --- | --- |
| `gpt_call` | Text, code, analysis and translation. Sends only the prompt and context explicitly supplied for the request. |
| `gpt_image` | Generates 1–4 images in PNG, JPEG or WebP. |
| `gpt_models` | Requests `/models` to check the connection and list models, without starting a generation request. |

Optional parameters:

```js
gpt_call({ prompt, context, instructions, model, max_output_tokens })
gpt_image({ prompt, model, size, quality, output_format, n })
gpt_models()
```

`gpt_call` defaults to 4096 output tokens and accepts 1–32768. Supported image sizes and quality levels vary by model.

### Files, credentials and usage

- Images are saved under `output/gpt-api/` in the conversation's current working directory, with unique filenames and no overwrites. The tool returns original file paths and attempts to attach previews.
- Keys are stored through the DSH credential service. The settings page reads presence only; leaving the key field blank keeps the current key. This repository contains no credentials or personal environment files.
- Tools do not automatically send the full conversation or upload workspace files.
- Text and image requests use the configured provider's API balance. A ChatGPT subscription is separate from API billing.
- Timed-out requests are not retried automatically. A read-only workspace is detected before an image generation request starts.

### Updates and troubleshooting

For a GitHub installation, uninstall the plugin and reinstall using the same URL to update. Refresh the page if the new UI has not appeared; restart DSH if needed.

| Symptom | What to check |
| --- | --- |
| HTTP 401 | Verify the key and its matching base URL. A gateway key belongs with that gateway's endpoint. |
| HTTP 404 or missing text | Check the model ID and text API mode: `responses` or `chat-completions`. |
| Empty model list | Check whether the provider returns models from `/models`. The dialog shows the actual response, not sample models. |
| Slow requests | Adjust the timeout within 1000–600000 milliseconds. Retries are explicit. |

Chat Completions requests use `max_completion_tokens`. The provider must accept that field. Image requests use GPT Image parameters; DALL·E-specific parameters are not separately adapted.

## 开发与测试 / Development and tests

本地开发使用链接安装；请保留源码目录。For local development, use a link installation and keep the source directory:

```bash
git clone https://github.com/wildbyteai/dsh-gpt-api.git
cd dsh-gpt-api
dsh plugin --profile desktop add "link:$(pwd)"
```

在具备插件所需 DSH 依赖的环境中运行 / Run in an environment with the plugin's DSH dependencies available:

```bash
node --test test/*.test.js
```

**29 项本地测试通过 / 29 local tests pass.** Tests cover Responses, Chat Completions, model selection, native Connection RPC, image decoding and saving, credential redaction, cancellation and default models. They use local fixtures and incur no API generation charges.

测试基于 DSH `0.2.1-rc.5` 的依赖；Node.js 要求为 22 或更高。安装兼容性由 [package.json](<package.json>) 的版本声明及 DSH 检查决定。浏览器端完整验收尚未完成。

Tests use DSH `0.2.1-rc.5` dependencies and require Node.js 22 or newer. Installation compatibility is governed by the manifest and DSH checks. Full browser end-to-end validation is still pending.

## 项目与许可 / Project and license

独立社区插件，参考 [OpenAI Developers](https://github.com/openai/plugins/tree/main/plugins/openai-developers) 的插件入口思路。Independent community plugin inspired by OpenAI Developers; not an official OpenAI plugin.

[问题反馈 / Issues](https://github.com/wildbyteai/dsh-gpt-api/issues) · [MIT License](<LICENSE>) · [OpenAI 图片生成文档 / Image generation docs](https://developers.openai.com/api/docs/guides/image-generation)
