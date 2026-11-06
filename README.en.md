# GPT API plugin

[简体中文](<README.md>) | **English**

Call GPT, generate images from text or local references, and select provider models from a dialog inside DeepSeek Harness. Current version: **1.2.0**.

## Installation

### Use the GitHub link

1. Open **Plugins → Add plugin** in the DSH sidebar.
2. Paste this repository URL and click **Install**. No manual cloning or build step is needed.

```text
https://github.com/wildbyteai/dsh-gpt-api
```

3. Open **Plugins → GPT API** and configure your API key and base URL.

The repository contains no API key. Use the official endpoint for an OpenAI key, or the provider's own endpoint for a gateway key.

### Install from the CLI

```bash
dsh plugin --profile desktop add "github:wildbyteai/dsh-gpt-api"
```

[Reference images](#reference-guided-image-generation) · [Parameters](#parameters) · [Results and usage](#results-and-usage) · [Troubleshooting](#troubleshooting)

## Setup and use

1. Enter and save your API key and base URL. Include the API prefix, such as `/v1`; the plugin appends the specific endpoint path.
2. Click **Fetch models** next to **Text model** or **Image model**.
3. Search the dialog, select a model, then click **Save changes**.
4. Ask for GPT API in a conversation:

```text
Use GPT API to review this code and identify potential bugs.
Use GPT API to generate a square watercolor image of an orange cat resting by a sunny window.
Check the GPT API connection and list available models.
```

Pending endpoint settings are saved before fetching models. The dialog handles search, loading, empty lists and explicit retries. Escape closes it and cancels the request. Image-related names are sorted first without hiding other returned models.

### Default settings

| Setting | Default | Notes |
| --- | --- | --- |
| API base URL | `https://api.openai.com/v1` | OpenAI-compatible provider URLs also work. |
| Text model | `gpt-6.1-sol` | Select a model available from your provider. |
| Image model | `gpt-image-2.6-flare` | The provider must support the required image endpoint. |
| Text API | `responses` | Also supports `chat-completions`. |
| Request timeout | `180000` milliseconds | Configurable within 1000–600000 milliseconds. |
| Credential reference | `DSH_GPT_API_KEY` | The key is stored through DSH's credential service. |

Manually saved model selections take precedence over the defaults. A model's presence in the list does not guarantee that the provider supports all its capabilities.

Remote endpoints require HTTPS; local services can use HTTP. Base URLs should not contain usernames, passwords, query parameters or fragments. Fetching models from the selection dialog has a separate 30-second upper limit.

## Reference-guided image generation

### Prepare the files

Save references within the current conversation workspace. Folder names are not fixed; this is an example layout:

```text
workspace/
├── assets/
│   ├── subject.png
│   └── style.webp
└── output/
    └── gpt-api/       # Generated results are saved here
```

- Supports PNG, JPEG and WebP: at most 10 images, each up to 30 MiB.
- Relative paths use the current conversation working directory. Absolute paths within the workspace also work.
- Save conversation attachments into the workspace before using their file paths.
- Download remote images into the workspace first. `reference_images` takes local paths, not URLs, Base64 or file IDs.
- Reference file content is uploaded to your configured provider. Originals remain unchanged; results are saved separately.

### Single reference

Describe both the source and the desired change in the conversation:

```text
Use GPT API with assets/subject.png as the reference.
Keep the subject and composition, replace the background with a beach, and produce a landscape image.
```

Equivalent tool call example:

```js
gpt_image({
  prompt: "Keep the reference subject and composition; replace the background with a beach",
  reference_images: ["assets/subject.png"],
  size: "1536x1024",
  quality: "high"
})
```

### Multiple references

Describe each image's role, such as subject and style:

```text
Use assets/subject.png as the subject reference and assets/style.webp as the color and style reference.
Keep the first image's subject features, use the second image's palette, and create a square product image.
```

```js
gpt_image({
  prompt: "Keep the first reference image's subject features and use the second reference image's palette and style",
  reference_images: ["assets/subject.png", "assets/style.webp"],
  size: "1024x1024",
  output_format: "png",
  n: 1
})
```

With references, actual files are uploaded as multipart images to `/images/edits`. Omitting `reference_images` or passing an empty array uses `/images/generations` for text-to-image requests.

The provider and model must support reference editing. The current tool performs prompt-based generation or whole-image editing and exposes no `mask` parameter. Subject, style and composition preservation depend on the model.

## Conversation tools

| Tool | Purpose |
| --- | --- |
| `gpt_call` | Text, code, analysis and translation. Sends only the explicitly supplied prompt and context. |
| `gpt_image` | Text-to-image or reference-guided generation, requesting 1–4 images. |
| `gpt_models` | Queries `/models` to check the connection and list models, without a generation request. |

You can usually describe the task directly in a conversation. The parameters below are useful when specifying generation options or integrating the tools.

## Parameters

### `gpt_image`

| Parameter | Default | Description |
| --- | --- | --- |
| `prompt` | Required | Describe the scene, desired changes and details to preserve. |
| `reference_images` | None | Up to 10 local image paths within the workspace; omitted or empty means text-to-image. |
| `model` | Configured image model | Override the model for this call. |
| `size` | `auto` | Common sizes: `1024x1024`, `1536x1024`, `1024x1536`. Other dimensions depend on the model. |
| `quality` | `auto` | `low`, `medium`, `high`, `xhigh`, `max` or `auto`; higher levels require model support. |
| `output_format` | `png` | `png`, `jpeg` or `webp`. |
| `n` | `1` | Requested count, an integer from 1–4. The provider determines the actual number returned. |

### `gpt_call`

| Parameter | Default | Description |
| --- | --- | --- |
| `prompt` | Required | The task to send to GPT. |
| `context` | None | Explicitly selected context; the full conversation is not uploaded automatically. |
| `instructions` | None | Style or behavior instructions for this call. |
| `model` | Configured text model | Override the model for this call. |
| `max_output_tokens` | `4096` | Output limit, an integer from 1–32768. |

`gpt_models()` takes no arguments. Chat Completions requests use `max_completion_tokens`, which the provider must accept. Image requests use GPT Image parameters; DALL·E-specific parameters are not separately adapted.

## Results and usage

Generated images are saved under `output/gpt-api/` in the conversation's current working directory, with unique filenames and no overwrites. The tool returns original file paths and attempts to attach previews.

Main result fields:

| Field | Meaning |
| --- | --- |
| `model` | The model returned by the provider, or the requested model. |
| `files[].path` | Absolute path to the saved original output. |
| `files[].revised_prompt` | A rewritten prompt returned by the provider, or `null`. |
| `references[]` | Reference filenames and SHA-256 hashes for checking the uploaded inputs. |
| `usage` | Provider usage data, or `null`. |

Reference bytes are sent only to the image API request; full reference Base64 is not included in tool results. If a preview fails, the saved original remains available at its returned path.

Keys are stored through DSH's credential service. The configuration page reads presence only; leaving the key field blank keeps the current key. Tools do not automatically upload full conversations or workspace files.

Text and image requests use the configured provider's API balance. A ChatGPT subscription is separate from API billing. Timed-out requests are not retried automatically; check existing results before calling again to avoid duplicate generation. A read-only workspace is detected before image generation starts.

## Updating

For a GitHub installation, uninstall the plugin and reinstall using the same URL to get the current main-branch code. Refreshing the page updates its display; it does not download new GitHub source.

For a local link installation, run `git pull --ff-only` in the source directory, then turn the plugin off and on to trigger recomposition. Restart DSH if needed. Keep the source directory, since the link installation uses its files.

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| HTTP 401 | Check that the key is valid and matches the base URL. Use a gateway key with that gateway's endpoint. |
| 400 or 404 from `/images/edits` | Verify multipart reference editing support and the selected image model. |
| Reference file not found | Check that the file is saved and the path is relative to the current working directory. Download remote images or save attachments into the workspace first. |
| Reference outside the workspace | Copy the input into the conversation workspace and use its local path. Symlinks pointing outside are also checked. |
| Invalid format or oversized image | Use real PNG, JPEG or WebP files, each up to 30 MiB. Renaming an extension does not convert the file. |
| Empty model list | Check whether the provider returns models from `/models`. The dialog shows real responses, not sample models. |
| Request timeout | Text and image timeouts are configurable within 1000–600000 milliseconds. The model dialog has a 30-second upper limit; retries are explicit. |
| New options do not appear | Reinstall a GitHub-installed copy, or recompose a local link installation. Then refresh the page or restart DSH. |

## Local development and tests

```bash
git clone https://github.com/wildbyteai/dsh-gpt-api.git
cd dsh-gpt-api
dsh plugin --profile desktop add "link:$(pwd)"
```

Run in an environment with the plugin's DSH dependencies available:

```bash
node --test test/*.test.js
```

41 local tests pass, covering text APIs, model selection, native RPC, reference file uploads, image saving, path and size checks, credential redaction, cancellation and default models. Tests use local mock APIs and incur no generation charges. Real reference-guided generation quality and full browser end-to-end validation have not been verified.

Requires Node.js 22 or newer. The package declares DSH `>=0.2.1-rc.5 <0.3.0`; dependency versions and installation checks are governed by [package.json](<package.json>) and DSH's diagnostics.

## Project and license

An independent community plugin inspired by [OpenAI Developers](https://github.com/openai/plugins/tree/main/plugins/openai-developers), not an official OpenAI plugin.

- [Report an issue](https://github.com/wildbyteai/dsh-gpt-api/issues)
- [MIT License](<LICENSE>)
- [OpenAI image generation docs](https://developers.openai.com/api/docs/guides/image-generation)
