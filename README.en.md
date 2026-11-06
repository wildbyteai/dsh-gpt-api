# GPT API plugin

[简体中文](<README.md>) | **English**

Call GPT, generate images, and select models from a dialog inside DeepSeek Harness.

## Installation

### Use the GitHub link

1. Open **Plugins → Add plugin** in the DSH sidebar.
2. Paste this URL and click **Install**. No manual cloning or build step is needed.

```text
https://github.com/wildbyteai/dsh-gpt-api
```

After installation, open **Plugins → GPT API** to configure your own API key and endpoint.

### Install from the CLI

```bash
dsh plugin --profile desktop add "github:wildbyteai/dsh-gpt-api"
```

## Setup and use

1. Open **Plugins → GPT API** and enter your API key and base URL.
2. Click **Fetch models** next to **Text model** or **Image model**.
3. Search the dialog, select a model, then click **Save changes**.
4. Ask for GPT API in a conversation:

```text
Use GPT API to review this code and identify potential bugs.
Use GPT API to generate a square watercolor image of an orange cat resting by a sunny window.
Check the GPT API connection and list available models.
```

Pending endpoint settings are saved before fetching models. The dialog handles loading, search, errors, explicit retries and Escape to close. Closing cancels the request. Image-related names are sorted first without hiding other models. Capabilities depend on the provider.

### Default settings

| Setting | Default |
| --- | --- |
| API base URL | `https://api.openai.com/v1` |
| Text model | `gpt-6.1-sol` |
| Image model | `gpt-image-2.6-flare` |
| Text API | `responses` |
| Request timeout | `180000` milliseconds |
| Credential reference | `DSH_GPT_API_KEY` |

Manually saved model selections take precedence over the defaults.

OpenAI-compatible providers can use their own base URL, including an API prefix such as `/v1`. Remote endpoints require HTTPS; local services can use HTTP. Text requests support `responses` and `chat-completions`.

## Conversation tools

| Tool | Purpose |
| --- | --- |
| `gpt_call` | Text, code, analysis and translation. Sends only the supplied prompt and context. |
| `gpt_image` | Generates 1–4 images in PNG, JPEG or WebP. |
| `gpt_models` | Queries `/models` to check the connection and list models, without a generation request. |

Parameter interfaces:

```js
gpt_call({ prompt, context, instructions, model, max_output_tokens })
gpt_image({ prompt, model, size, quality, output_format, n })
gpt_models()
```

`prompt` is required for `gpt_call` and `gpt_image`; the other parameters are optional. Text output defaults to 4096 tokens and accepts 1–32768. Supported image sizes and quality levels vary by model.

### Images and credentials

- Images are saved under `output/gpt-api/` in the conversation's current working directory, with unique filenames and no overwrites. The tool returns original paths and attempts to attach previews.
- Keys are stored through the DSH credential service. The settings page reads presence only; leaving the key field blank keeps the current key. This repository contains no credentials or personal environment files.
- Tools do not automatically upload the full conversation or workspace files. The client's model-list request parameters contain no API key.
- Text and image requests use the configured provider's API balance. A ChatGPT subscription is separate from API billing.
- Timed-out requests are not retried automatically. A read-only workspace is detected before an image generation request starts.

## Updates and troubleshooting

For a GitHub installation, uninstall the plugin and reinstall using the same URL to update. Refresh the page if the new UI has not appeared; restart DSH if needed.

| Symptom | What to check |
| --- | --- |
| HTTP 401 | Verify the key and its matching base URL. A gateway key belongs with that gateway's endpoint. |
| HTTP 404 or missing text | Check the model ID and text API mode. |
| Empty model list | Check whether the provider returns models from `/models`. The dialog shows actual results, not sample models. |
| Slow requests | Adjust the timeout within 1000–600000 milliseconds. Retries are explicit. |

Chat Completions requests use `max_completion_tokens`; the provider must accept that field. Image requests use GPT Image parameters. DALL·E-specific parameters are not separately adapted.

## Local development and tests

```bash
git clone https://github.com/wildbyteai/dsh-gpt-api.git
cd dsh-gpt-api
dsh plugin --profile desktop add "link:$(pwd)"
```

Keep the source directory for a link installation. Run tests in an environment with the plugin's DSH dependencies available:

```bash
node --test test/*.test.js
```

29 local tests pass, covering text APIs, model selection, native RPC, image saving, credential redaction, cancellation and default models. Tests use local fixtures and incur no API generation charges. Full browser end-to-end validation is still pending.

Tests use DSH `0.2.1-rc.5` dependencies and require Node.js 22 or newer. Dependency versions and installation compatibility declarations are in [package.json](<package.json>).

## Project and license

An independent community plugin inspired by [OpenAI Developers](https://github.com/openai/plugins/tree/main/plugins/openai-developers), not an official OpenAI plugin.

- [Report an issue](https://github.com/wildbyteai/dsh-gpt-api/issues)
- [MIT License](<LICENSE>)
- [OpenAI image generation docs](https://developers.openai.com/api/docs/guides/image-generation)
