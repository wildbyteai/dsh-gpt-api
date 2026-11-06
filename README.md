# GPT API 插件

为 DeepSeek Harness 桌面版增加 GPT API 配置、文本调用和图片生成。参考 OpenAI Developers 的插件入口思路，使用 DSH 原生 bundle、配置页、凭据服务和对话工具实现；这是独立插件，不是 OpenAI 官方插件。

## 开始使用

1. 在侧栏打开 **插件**，找到 **GPT API**。可从插件卡片的配置页进入；也提供 GPT API 设置入口。
2. 检查 API Key 与 API 基础地址。密钥通过 DSH 凭据服务保存，配置引用默认为 `DSH_GPT_API_KEY`；界面只显示配置状态，密钥留空保留原值。
3. 在“文本模型”或“图片模型”旁点击 **获取模型**。插件先保存当前接口与密钥配置，再从已认证的 Host 请求模型列表。
4. 在弹窗中搜索模型名称，点击某个模型回填，然后点 **保存更改**。弹窗支持加载状态、空列表、错误重试、Escape 关闭与取消请求；图片相关名称优先排序，但仍保留全部返回模型。
5. 随后可说「调用 GPT，帮我审查这段代码」或「用 GPT 生图：一只在窗边晒太阳的橘猫，水彩风格」。也可通过 `gpt_models` 检查连接。

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| API 基础地址 | `https://api.openai.com/v1` | 包含 `/v1`；插件自行追加接口路径。支持自定义 OpenAI 兼容网关。 |
| 文本模型 | `gpt-5.4` | 按账号或网关实际支持的模型 ID 修改。 |
| 生图模型 | `gpt-image-2` | 适用于支持 Images API 的 GPT Image 模型；也可填写账号支持的新型号。 |
| 文本接口 | `responses` | 支持 `responses` 和 `chat-completions`。 |
| 请求超时 | `180000` 毫秒 | 可配置 1000–600000 毫秒；复杂生图可增加。 |

Chat Completions 模式使用 `max_completion_tokens`。较旧且仅识别 `max_tokens` 的网关需升级兼容实现。生图接口使用 GPT Image 参数，未单独适配 DALL·E 专有参数。

API 用量计入配置的 API 账号；ChatGPT 订阅不等于 API 额度。真实模型可用性、计费和图像参数以所配置提供方为准。

## 对话工具

- `gpt_models()`：查询 `/models`、检查连接。
- `gpt_call({ prompt, context?, instructions?, model?, max_output_tokens? })`：文本、代码、翻译和分析。只发送明确传入的上下文，不自动上传整段会话或工作区文件。
- `gpt_image({ prompt, model?, size?, quality?, output_format?, n? })`：生成 1–4 张图片，支持 PNG、JPEG 和 WebP。

图片写入当前对话工作目录的 `output/gpt-api/`，采用唯一文件名和独占创建，保留原有文件。返回原图路径，并尝试附加原生图片预览；随后助手可展示图片或添加文件卡片。只读工作区会在请求生成前提示切换为可写模式。

网络调用不自动重试，避免超时后重复计费。取消信号会传递给请求及保存操作。

## 安装与更新

适配并测试的版本为 DSH `0.2.1-rc.5`，包内 peer dependencies 对应此版本。

### 从 GitHub 安装

仓库：[wildbyteai/dsh-gpt-api](https://github.com/wildbyteai/dsh-gpt-api)。在 DSH 插件页面输入仓库地址，或使用 CLI：

```bash
dsh plugin --profile desktop add "github:wildbyteai/dsh-gpt-api"
```

### 本地开发

```bash
git clone https://github.com/wildbyteai/dsh-gpt-api.git
cd dsh-gpt-api
dsh plugin --profile desktop add "link:$(pwd)"
```

本地链接安装请保留源码目录。插件包含已可执行的 Host 和 Client 文件，无需额外前端构建服务器。

也可以将源码下载或解压后，通过插件页面的本地安装入口安装，或运行：

```bash
dsh plugin --profile desktop add "/absolute/path/dsh-gpt-api"
```

若运行中的插件页尚未更新，刷新页面；如仍未出现则重启 DSH。代码更新需触发插件重组或重启，普通页面刷新不保证替换已缓存的 Host 模块。

## 验证

```bash
node --test test/*.test.js
```

本机测试通过模拟 HTTP API 覆盖 Responses、Chat Completions、模型列表、生图 Base64 解码、独占保存、路径检查、取消、非 JSON 响应、401 密钥脱敏和无自动重试。测试不使用真实凭据，不产生 API 生成费用。

1.1.0 新增模型选择弹窗及模型列表路由；本地测试还覆盖 DSH 原生 Connection RPC 协议、获取前保存、选择回填、401 错误、取消请求与过期响应忽略。

公开仓库不包含 API Key、Codex 环境文件或本地凭据。请在插件配置页填写自己的 Key；密钥由 DSH 凭据服务保存，不进入插件源码或 Git 历史。

本地模拟 API、客户端契约及原生 Connection RPC 共 28 项测试通过。真实模型列表和生图依赖提供方、API 地址及 Key；HTTP 401 会在模型弹窗中显示，请检查 Key 与接口地址是否匹配。浏览器端完整验收尚未完成。

## 参考

- [OpenAI Developers 插件](https://github.com/openai/plugins/tree/main/plugins/openai-developers)
- [OpenAI 图片生成 API](https://developers.openai.com/api/docs/guides/image-generation)
