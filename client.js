/* Ready-built DSH browser plugin. No build step or external assets. */
window.__ModuleLoader__.load({
  id: "dsh-gpt-api",
  factory(require) {
    "use strict";

    const { jsx, jsxs } = require("react/jsx-runtime");
    const { useEffect, useRef } = require("react");
    const {
      SettingsFormModel, SettingsForm, SettingsValueField, SettingsSecretField,
      settingsTextField, settingsNumberField,
    } = require("@deepseek-ai/dsh-client-ui-primitives");
    const { createSnapshotStore } = require("@deepseek-ai/dsh-client-store");

    const NS = "gptApi.settings";
    const CONFIG_NS = "gpt-api";
    const KEY_REF = "DSH_GPT_API_KEY";
    const FIELDS = ["baseURL", "textModel", "imageModel", "textAPI", "timeoutMs"];
    const dictionaries = {
      en: {
        title: "GPT API",
        description: "Use GPT for text and image tasks in your DSH conversations. Configure an OpenAI-compatible endpoint and keep its API key in the credential store.",
        baseURL: "API base URL",
        baseURLHint: "Include the API prefix, for example https://api.openai.com/v1. HTTPS is required except for localhost; omit credentials, query, and fragment. Blank restores the inherited default.",
        textModel: "Text model",
        textModelHint: "Default: gpt-6.1-sol. Enter a model supported by your endpoint.",
        imageModel: "Image model",
        imageModelHint: "Click Fetch models, then select an image model from your endpoint.",
        fetchModels: "Fetch models",
        pickerTextTitle: "Select text model",
        pickerImageTitle: "Select image model",
        pickerHint: "Uses your saved API endpoint and key. Pending settings are saved before fetching; selection is staged until Save changes.",
        searchModels: "Search model names",
        modelsLoading: "Fetching models…",
        modelsEmpty: "The API returned no models.",
        modelsNoMatch: "No matching models.",
        modelsRetry: "Fetch again",
        modelsSaveFirst: "Check and save your API settings before fetching models.",
        modelsSelected: "Current selection",
        modelsCount: "models",
        closePicker: "Close",
        chooseHint: "Select a model to return to settings. Model IDs alone do not guarantee support for this task.",
        textAPI: "Text API",
        textAPIHint: "Responses is the default. Choose Chat Completions for endpoints that use that protocol.",
        timeoutMs: "Request timeout (ms)",
        timeoutMsHint: "Default: 180000 ms (3 minutes). Enter a whole number from 1000 to 600000; images may take longer than text.",
        apiKey: "API key",
        apiKeyHint: "Stored as DSH_GPT_API_KEY in the credential store, separately from settings. Leave blank to keep the current key. Existing key values are never read by this page.",
        keyChecking: "Checking key status…",
        keyConfigured: "A key is configured.",
        keyMissing: "No key is configured. Enter one to use GPT API.",
        keyError: "Key status check failed. Retry to read its status.",
        keyReadOnly: "The credential store is read-only.",
        retry: "Retry key status",
        overridden: "Overridden",
        reset: "Reset to default",
        invalidURL: "Use HTTPS (HTTP for localhost only), without credentials, query, or fragment; blank restores the default.",
        invalidNumber: "Enter a whole number from 1000 to 600000, or leave blank for the default.",
        invalidText: "Enter a model name, or leave blank for the default.",
        unavailable: "Enable the GPT API host plugin to edit these settings.",
        readOnly: "This deployment stores settings read-only.",
        save: "Save changes",
        saving: "Saving…",
        saveFailed: "Some changes were not saved. Check the fields and retry; remaining edits are preserved.",
        keySaveFailed: "The API key was not saved. Check that the credential store is writable, then retry.",
        saved: "Changes saved.",
        examples: "Try it in a conversation",
        examplesHint: "After saving, ask DSH to use GPT API. Select and copy an example to get started.",
        textExampleTitle: "Write with GPT",
        textExample: "Use GPT API to turn these meeting notes into a concise summary with decisions, owners, and next steps: [paste notes].",
        imageExampleTitle: "Create an image",
        imageExample: "Use GPT API to generate a square product photo of a cobalt-blue ceramic cup on a white background, soft natural light, no text.",
      },
      zh: {
        title: "GPT API",
        description: "在 DSH 对话中使用 GPT 处理文本和生成图片。设置兼容 OpenAI 的接口，并将 API Key 单独保存在凭据存储中。",
        baseURL: "API 基础地址",
        baseURLHint: "填写含 API 前缀的 HTTPS 地址，例如 https://api.openai.com/v1；本机地址支持 HTTP。省略账号、查询参数和片段，留空恢复默认。",
        textModel: "文本模型",
        textModelHint: "默认 gpt-6.1-sol，也可填写接口支持的其他模型。",
        imageModel: "图片模型",
        imageModelHint: "点击获取模型，在接口返回的列表中选择图片模型。",
        fetchModels: "获取模型",
        pickerTextTitle: "选择文本模型",
        pickerImageTitle: "选择图片模型",
        pickerHint: "使用已保存的 API 地址和密钥。获取前会保存当前配置；选中模型后再点“保存更改”生效。",
        searchModels: "搜索模型名称",
        modelsLoading: "正在获取模型…",
        modelsEmpty: "接口未返回任何模型。",
        modelsNoMatch: "没有匹配的模型。",
        modelsRetry: "重新获取",
        modelsSaveFirst: "请检查并保存接口配置后再获取模型。",
        modelsSelected: "当前选择",
        modelsCount: "个模型",
        closePicker: "关闭",
        chooseHint: "点击模型即可返回设置。模型名称不代表接口一定支持当前任务。",
        textAPI: "文本接口",
        textAPIHint: "默认使用 Responses；兼容接口使用旧版协议时，选择 Chat Completions。",
        timeoutMs: "请求超时（毫秒）",
        timeoutMsHint: "默认 180000 毫秒（3 分钟）。填写 1000–600000 的整数；图片生成通常比文本耗时更长。",
        apiKey: "API Key",
        apiKeyHint: "以 DSH_GPT_API_KEY 保存到凭据存储，与设置分开。留空保留当前密钥，本页只查询配置状态，不读取已有密钥。",
        keyChecking: "正在查询密钥状态…",
        keyConfigured: "已配置密钥。",
        keyMissing: "尚未配置密钥，填写后即可使用 GPT API。",
        keyError: "密钥状态查询失败，请重试。",
        keyReadOnly: "凭据存储为只读。",
        retry: "重新查询密钥状态",
        overridden: "已覆盖",
        reset: "恢复默认",
        invalidURL: "请使用 HTTPS（本机可用 HTTP），省略账号、查询参数和片段；留空使用默认值。",
        invalidNumber: "请填写 1000–600000 的整数；留空使用默认值。",
        invalidText: "请填写模型名称；留空使用默认值。",
        unavailable: "启用 GPT API 主机插件后可编辑这些设置。",
        readOnly: "本部署的设置为只读。",
        save: "保存更改",
        saving: "保存中…",
        saveFailed: "部分更改尚未保存。请检查字段后重试，待保存的修改已保留。",
        keySaveFailed: "密钥保存失败，请检查凭据存储的写入状态后重试。",
        saved: "更改已保存。",
        examples: "在对话中试试",
        examplesHint: "保存后，让 DSH 使用 GPT API。可选中并复制下面的示例。",
        textExampleTitle: "使用 GPT 写作",
        textExample: "使用 GPT API，把下面的会议记录整理成简洁的摘要，列出决策、负责人和下一步行动：[粘贴记录]。",
        imageExampleTitle: "生成图片",
        imageExample: "使用 GPT API，生成一张正方形产品摄影图：钴蓝色陶瓷杯，纯白背景，柔和自然光，无文字。",
      },
    };

    // Scoped additions only; shared controls retain DSH's native styling.
    const css = `
.dsh-gpt-api { color: var(--dsw-alias-label-primary, #202124); min-width: 0; }
.dsh-gpt-api__description { color: var(--dsw-alias-label-secondary, #666); font-size: 13px; line-height: 1.65; max-width: 72ch; margin: 0 0 22px; }
.dsh-gpt-api__select-field { display: grid; gap: 8px; min-width: 0; }
.dsh-gpt-api__label-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 13px; }
.dsh-gpt-api__hint { color: var(--dsw-alias-label-tertiary, #8a8a8a); font-size: 12px; line-height: 1.55; margin: 0; overflow-wrap: anywhere; }
.dsh-gpt-api__select { box-sizing: border-box; width: 100%; min-width: 0; min-height: 36px; padding: 7px 10px; color: var(--dsw-alias-label-primary, #202124); background: var(--dsw-alias-settings-card-fill, #fff); border: 1px solid var(--dsw-alias-border-l3, #e6e6e6); border-radius: 8px; font: inherit; font-size: 13px; }
.dsh-gpt-api__select:focus-visible, .dsh-gpt-api__text-button:focus-visible { outline: 2px solid var(--dsw-alias-link, #4d6bfe); outline-offset: 2px; }
.dsh-gpt-api__select:disabled { opacity: .55; cursor: not-allowed; }
.dsh-gpt-api__text-button { appearance: none; padding: 2px 0; border: 0; background: transparent; color: var(--dsw-alias-link, #4d6bfe); font: inherit; font-size: 12px; cursor: pointer; text-align: left; }
.dsh-gpt-api__text-button:disabled { opacity: .55; cursor: default; }
.dsh-gpt-api__status { font-size: 12px; line-height: 1.55; margin: 0 0 16px; color: var(--dsw-alias-label-secondary, #666); }
.dsh-gpt-api__examples { margin-top: 28px; padding-top: 20px; border-top: 1px solid var(--dsw-alias-border-l3, #e6e6e6); }
.dsh-gpt-api__examples h3 { font-size: 14px; font-weight: 600; line-height: 1.5; margin: 0 0 6px; }
.dsh-gpt-api__example-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr)); gap: 12px; margin-top: 12px; }
.dsh-gpt-api__example { min-width: 0; padding: 14px; border-radius: 10px; background: var(--dsw-alias-bg-module-platform, #f7f7f8); }
.dsh-gpt-api__example h4 { margin: 0 0 8px; font-size: 13px; font-weight: 500; line-height: 1.5; }
.dsh-gpt-api__example p { margin: 0; color: var(--dsw-alias-label-secondary, #666); font-size: 12px; line-height: 1.65; overflow-wrap: anywhere; user-select: text; }
.dsh-gpt-api__model-field { display: grid; gap: 8px; }
.dsh-gpt-api__model-row { display: flex; align-items: center; gap: 10px; }
.dsh-gpt-api__model-value { min-width: 0; flex: 1; padding: 9px 10px; border: 1px solid var(--dsw-alias-border-l3, #e6e6e6); border-radius: 8px; overflow-wrap: anywhere; font-size: 13px; }
.dsh-gpt-api__model-action { padding: 8px 12px; border: 1px solid var(--dsw-alias-border-l3, #e6e6e6); border-radius: 8px; background: var(--dsw-alias-bg-module-platform, #f7f7f8); color: var(--dsw-alias-label-primary, #202124); font: inherit; font-size: 13px; cursor: pointer; white-space: nowrap; }
.dsh-gpt-api__model-action:disabled { opacity: .5; cursor: default; }
.dsh-gpt-api__model-action:focus-visible, .dsh-gpt-api__model-option:focus-visible { outline: 2px solid var(--dsw-alias-link, #4d6bfe); outline-offset: 2px; }
.dsh-gpt-api__dialog { box-sizing: border-box; width: min(560px, calc(100vw - 32px)); max-height: min(680px, calc(100dvh - 48px)); padding: 0; border: 1px solid var(--dsw-alias-border-l3, #e6e6e6); border-radius: 16px; background: var(--dsw-alias-bg-layer-1, #fff); color: var(--dsw-alias-label-primary, #202124); box-shadow: 0 20px 70px #0003; }
.dsh-gpt-api__dialog::backdrop { background: #0006; }
.dsh-gpt-api__dialog-inner { display: flex; flex-direction: column; gap: 14px; padding: 22px; max-height: inherit; box-sizing: border-box; }
.dsh-gpt-api__dialog-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.dsh-gpt-api__dialog h2 { margin: 0; font-size: 18px; font-weight: 600; }
.dsh-gpt-api__model-list { overflow-y: auto; min-height: 100px; max-height: 350px; padding: 3px; display: grid; gap: 4px; }
.dsh-gpt-api__model-option { width: 100%; border: 1px solid transparent; border-radius: 8px; background: transparent; color: inherit; text-align: left; padding: 11px 12px; font: inherit; font-size: 13px; overflow-wrap: anywhere; cursor: pointer; display: flex; justify-content: space-between; gap: 14px; }
.dsh-gpt-api__model-option:hover, .dsh-gpt-api__model-option[aria-current=true] { background: var(--dsw-alias-bg-module-platform, #f7f7f8); border-color: var(--dsw-alias-border-l3, #e6e6e6); }
.dsh-gpt-api__model-error { color: var(--dsw-alias-label-primary, #202124); font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; margin: 0; }
`;

    class GptApiController {
      constructor(scope, ctx) {
        this.ctx = ctx;
        this.scope = scope;
        this.disposed = false;
        this.credentialGeneration = 0;
        this.credential = { ref: this.ref(), status: "loading", configured: false, writable: false };
        this.saved = false;
        this.keySaveFailed = false;
        this.modelPicker = null;
        this.modelRequest = null;
        this.form = new SettingsFormModel(scope, [
          {
            ...settingsTextField("baseURL"),
            parse(text) {
              const value = text.trim();
              if (!value) return { kind: "clear" };
              try {
                const url = new URL(value);
                const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
                if (!url.username && !url.password && !url.search && !url.hash &&
                    (url.protocol === "https:" || (url.protocol === "http:" && local))) {
                  return { kind: "set", value };
                }
              } catch (_) { /* The field displays the validation message. */ }
              return undefined;
            },
          },
          settingsTextField("textModel"),
          settingsTextField("imageModel"),
          {
            ...settingsTextField("textAPI"),
            parse(text) {
              if (!text.trim()) return { kind: "clear" };
              return ["responses", "chat-completions"].includes(text)
                ? { kind: "set", value: text } : undefined;
            },
          },
          {
            ...settingsNumberField("timeoutMs"),
            parse(text) {
              if (!text.trim()) return { kind: "clear" };
              const value = Number(text);
              return Number.isSafeInteger(value) && value >= 1000 && value <= 600000 ? { kind: "set", value } : undefined;
            },
          },
        ], [{ field: "apiKey", write: (text) => this.writeKey(text) }]);
        this.store = createSnapshotStore(this.projection());
        this.unsubscribe = this.form.bind(() => this.form.shell()).subscribe(() => this.publish());
        this.unsubscribeScope = scope.subscribe(() => {
          if (this.ref() === this.credential.ref) return;
          this.form.actions().edit("apiKey", "");
          this.readCredential();
        });
        this.readCredential();
      }

      ref() {
        const declared = this.scope.getSnapshot().value?.apiKeyEnv;
        return typeof declared === "string" && declared.trim() ? declared.trim() : KEY_REF;
      }

      projection() {
        return {
          ...this.form.shell(),
          failed: this.form.shell().failed || Boolean(this.saveFailed),
          ...Object.fromEntries(FIELDS.map((field) => [field, this.form.field(field)])),
          apiKey: this.form.field("apiKey"),
          credential: this.credential,
          saved: this.saved,
          keySaveFailed: this.keySaveFailed,
          modelPicker: this.modelPicker,
        };
      }

      publish() {
        if (!this.disposed) this.store.set(this.projection());
      }

      async readCredential() {
        const generation = ++this.credentialGeneration;
        const ref = this.ref();
        if (ref !== this.credential.ref) {
          this.credential = { ref, status: "loading", configured: false, writable: false };
          this.publish();
        }
        try {
          // Describe returns presence/writability only, never a key value.
          const response = await this.ctx.remote.credentials.describe([ref]);
          if (this.disposed || generation !== this.credentialGeneration) return;
          if (!response.ok) throw new Error("credential-status");
          const view = response.value[ref];
          this.credential = {
            ref, status: "ready", configured: view?.configured ?? false, writable: view?.writable ?? false,
          };
        } catch (_) {
          if (this.disposed || generation !== this.credentialGeneration) return;
          this.credential = { ...this.credential, status: "error", writable: false };
        }
        this.publish();
      }

      async writeKey(text) {
        // A blank secret never replaces or deletes the current key.
        if (!text.trim()) return true;
        try {
          const response = await this.ctx.remote.credentials.set(this.ref(), text.trim());
          if (!response.ok) throw new Error("credential-write");
          await this.readCredential();
          return true;
        } catch (_) {
          this.keySaveFailed = true;
          this.publish();
          return false;
        }
      }

      async save() {
        const state = this.form.shell();
        if (!state.available || !state.writable || !state.dirty || state.invalid || state.saving) return;
        this.saved = false;
        this.keySaveFailed = false;
        this.saveFailed = false;
        try {
          await this.form.save();
        } catch (_) {
          this.saveFailed = true;
        }
        this.saved = !this.saveFailed && !this.form.shell().failed && !this.form.shell().dirty;
        this.publish();
      }

      async openModelPicker(field) {
        if (!['textModel', 'imageModel'].includes(field) || this.form.shell().saving) return;
        this.modelRequest?.abort();
        const controller = new AbortController();
        this.modelRequest = controller;
        this.modelPicker = { field, status: 'loading', models: [], query: '', error: '', errorKey: '' };
        this.publish();
        try {
          if (this.form.shell().dirty) await this.save();
          if (this.modelRequest !== controller || this.disposed) return;
          if (this.form.shell().dirty || this.form.shell().invalid || this.form.shell().failed) {
            this.modelPicker = { ...this.modelPicker, status: 'error', errorKey: 'modelsSaveFirst' };
            this.publish();
            return;
          }
          const response = await this.ctx.connection.rpc.call('/api', 'gpt-api/models', {}, controller.signal);
          if (this.modelRequest !== controller || controller.signal.aborted || this.disposed) return;
          if (!response.ok) throw new Error(response.error?.message || '模型列表获取失败。');
          if (!Array.isArray(response.value?.models) || response.value.models.some(id => typeof id !== 'string')) {
            throw new Error('模型列表响应格式错误。');
          }
          const models = [...new Set(response.value.models)].filter(id => id.trim());
          const imageLike = id => /image|dall-e|imagen|flux/i.test(id);
          models.sort((a, b) => {
            const score = id => imageLike(id) === (field === 'imageModel') ? 0 : 1;
            return score(a) - score(b) || a.localeCompare(b);
          });
          this.modelPicker = { ...this.modelPicker, status: 'ready', models };
        } catch (error) {
          if (this.modelRequest !== controller || controller.signal.aborted || this.disposed) return;
          this.modelPicker = { ...this.modelPicker, status: 'error', error: String(error.message || '模型列表获取失败。') };
        }
        this.publish();
      }

      closeModelPicker() {
        this.modelRequest?.abort();
        this.modelRequest = null;
        this.modelPicker = null;
        this.publish();
      }

      chooseModel(id) {
        const picker = this.modelPicker;
        if (picker?.status !== 'ready' || !picker.models.includes(id)) return;
        this.form.actions().edit(picker.field, id);
        this.saved = false;
        this.closeModelPicker();
      }

      inject() {
        const actions = this.form.actions();
        const change = (action, ...args) => {
          this.saved = false;
          this.keySaveFailed = false;
          this.saveFailed = false;
          actions[action](...args);
          this.publish();
        };
        return {
          hooks: { gptApi: this.store },
          edit: (field, text) => change("edit", field, text),
          resetField: (field) => change("resetField", field),
          discard: () => change("discard"),
          save: () => this.save(),
          openModelPicker: field => this.openModelPicker(field),
          closeModelPicker: () => this.closeModelPicker(),
          chooseModel: id => this.chooseModel(id),
          searchModels: query => {
            if (this.modelPicker) this.modelPicker = { ...this.modelPicker, query };
            this.publish();
          },
          retryCredential: () => {
            this.credential = { ...this.credential, status: "loading", writable: false };
            this.publish();
            return this.readCredential();
          },
        };
      }

      dispose() {
        this.disposed = true;
        this.modelRequest?.abort();
        this.credentialGeneration++;
        this.unsubscribe();
        this.unsubscribeScope();
        this.form.dispose();
      }
    }

    function ModelPicker(props) {
      const { picker, t } = props;
      const dialog = useRef(null);
      useEffect(() => {
        const node = dialog.current;
        node?.showModal();
        return () => { if (node?.open) node.close(); };
      }, []);
      const models = picker.models.filter(id => id.toLowerCase().includes(picker.query.toLowerCase()));
      return jsx('dialog', {
        ref: dialog, className: 'dsh-gpt-api__dialog', 'aria-labelledby': 'dsh-gpt-model-title',
        onCancel: event => { event.preventDefault(); props.closeModelPicker(); },
        onClick: event => { if (event.target === event.currentTarget) props.closeModelPicker(); },
        children: jsxs('div', { className: 'dsh-gpt-api__dialog-inner', children: [
          jsxs('div', { className: 'dsh-gpt-api__dialog-header', children: [
            jsx('h2', { id: 'dsh-gpt-model-title', children: t(picker.field === 'imageModel' ? 'pickerImageTitle' : 'pickerTextTitle') }),
            jsx('button', { type: 'button', className: 'dsh-gpt-api__text-button', onClick: props.closeModelPicker, children: t('closePicker') }),
          ] }),
          jsx('p', { className: 'dsh-gpt-api__hint', children: t('pickerHint') }),
          jsx('input', { type: 'search', autoFocus: true, className: 'dsh-gpt-api__select', placeholder: t('searchModels'),
            'aria-label': t('searchModels'), value: picker.query, onChange: event => props.searchModels(event.target.value) }),
          picker.status === 'loading' && jsx('p', { role: 'status', className: 'dsh-gpt-api__hint', children: t('modelsLoading') }),
          picker.status === 'error' && jsx('p', { role: 'alert', className: 'dsh-gpt-api__model-error', children: picker.errorKey ? t(picker.errorKey) : picker.error }),
          picker.status === 'ready' && jsxs('div', { children: [
            jsx('p', { className: 'dsh-gpt-api__hint', role: 'status', children: `${models.length} ${t('modelsCount')}` }),
            jsx('div', { className: 'dsh-gpt-api__model-list', children: models.length ? models.map(id =>
              jsxs('button', { type: 'button', className: 'dsh-gpt-api__model-option', 'aria-current': id === props.selected,
                onClick: () => props.chooseModel(id), children: [jsx('span', { children: id }),
                  id === props.selected && jsx('span', { className: 'dsh-gpt-api__hint', children: t('modelsSelected') })] }, id))
              : jsx('p', { className: 'dsh-gpt-api__hint', children: t(picker.models.length ? 'modelsNoMatch' : 'modelsEmpty') }) }),
          ] }),
          jsx('p', { className: 'dsh-gpt-api__hint', children: t('chooseHint') }),
          jsx('button', { type: 'button', className: 'dsh-gpt-api__model-action', disabled: picker.status === 'loading',
            onClick: () => props.openModelPicker(picker.field), children: t('modelsRetry') }),
        ] }),
      });
    }

    function GptApiCard(props) {
      const { t } = props;
      const state = props.useGptApi((snapshot) => snapshot);
      if (props.view === "summary") return t("description");
      const disabled = !state.available || !state.writable || state.saving;
      const keyState = state.credential;
      const keyLabel = keyState.status === "loading" ? t("keyChecking")
        : keyState.status === "error" ? t("keyError")
        : keyState.configured ? t("keyConfigured") : t("keyMissing");
      const valueField = (field, invalidLabel = "invalidText") => jsx(SettingsValueField, {
        id: "dsh-gpt-api-" + field,
        label: t(field), hint: t(field + "Hint"),
        overriddenLabel: t("overridden"), resetLabel: t("reset"), invalidLabel: t(invalidLabel),
        numeric: field === "timeoutMs", disabled, ...state[field],
        onEdit: (text) => props.edit(field, text), onReset: () => props.resetField(field),
      }, field);
      const modelField = field => jsxs('div', {
        className: 'dsh-gpt-api__model-field', children: [
          jsx('span', { id: `dsh-gpt-api-${field}-label`, children: t(field) }),
          jsxs('div', { className: 'dsh-gpt-api__model-row', children: [
            jsx('output', { className: 'dsh-gpt-api__model-value', 'aria-labelledby': `dsh-gpt-api-${field}-label`, children: state[field].text || '—' }),
            jsx('button', { type: 'button', className: 'dsh-gpt-api__model-action', disabled,
              'aria-label': `${t('fetchModels')} — ${t(field)}`, 'aria-haspopup': 'dialog',
              onClick: () => props.openModelPicker(field), children: t('fetchModels') }),
          ] }),
        ],
      }, field);
      const labels = {
        unavailable: t("unavailable"), readOnly: t("readOnly"),
        saveFailed: t(state.keySaveFailed ? "keySaveFailed" : "saveFailed"),
        save: t("save"), saving: t("saving"),
      };
      return jsxs("div", {
        className: "dsh-gpt-api",
        children: [
          jsx("p", { className: "dsh-gpt-api__description", children: t("description") }),
          state.saved && !state.dirty && jsx("p", {
            className: "dsh-gpt-api__status", role: "status", children: t("saved"),
          }),
          jsxs(SettingsForm, {
            labels, state, onSave: props.save, onDiscard: props.discard,
            children: [
              jsx(SettingsSecretField, {
                id: "dsh-gpt-api-key", label: t("apiKey"), hint: t("apiKeyHint").replace("DSH_GPT_API_KEY", keyState.ref),
                disabled: disabled || !keyState.writable, text: state.apiKey.text,
                configured: keyState.configured,
                stateLabel: keyLabel + (keyState.status === "ready" && !keyState.writable ? " " + t("keyReadOnly") : ""),
                onEdit: (text) => props.edit("apiKey", text),
              }),
              keyState.status === "error" && jsx("button", {
                type: "button", className: "dsh-gpt-api__text-button", onClick: props.retryCredential,
                disabled: state.saving, children: t("retry"),
              }),
              valueField("baseURL", "invalidURL"), modelField("textModel"), modelField("imageModel"),
              jsxs("div", {
                className: "dsh-gpt-api__select-field",
                children: [
                  jsxs("div", {
                    className: "dsh-gpt-api__label-row",
                    children: [
                      jsx("label", { htmlFor: "dsh-gpt-api-textAPI", children: t("textAPI") }),
                      jsx("button", {
                        type: "button", className: "dsh-gpt-api__text-button", disabled,
                        onClick: () => props.resetField("textAPI"), children: t("reset"),
                      }),
                    ],
                  }),
                  jsxs("select", {
                    id: "dsh-gpt-api-textAPI", className: "dsh-gpt-api__select", disabled,
                    value: state.textAPI.text || "responses", "aria-describedby": "dsh-gpt-api-textAPI-hint",
                    onChange: (event) => props.edit("textAPI", event.target.value),
                    children: [
                      jsx("option", { value: "responses", children: "Responses" }),
                      jsx("option", { value: "chat-completions", children: "Chat Completions" }),
                    ],
                  }),
                  jsx("p", { id: "dsh-gpt-api-textAPI-hint", className: "dsh-gpt-api__hint", children: t("textAPIHint") }),
                ],
              }),
              valueField("timeoutMs", "invalidNumber"),
            ],
          }),
          state.modelPicker && jsx(ModelPicker, {
            ...props, picker: state.modelPicker, selected: state[state.modelPicker.field].text,
          }),
          jsxs("section", {
            className: "dsh-gpt-api__examples", "aria-labelledby": "dsh-gpt-api-examples",
            children: [
              jsx("h3", { id: "dsh-gpt-api-examples", children: t("examples") }),
              jsx("p", { className: "dsh-gpt-api__hint", children: t("examplesHint") }),
              jsx("div", {
                className: "dsh-gpt-api__example-grid",
                children: ["text", "image"].map((kind) => jsxs("article", {
                  className: "dsh-gpt-api__example",
                  children: [jsx("h4", { children: t(kind + "ExampleTitle") }), jsx("p", { children: t(kind + "Example") })],
                }, kind)),
              }),
            ],
          }),
        ],
      });
    }

    const inject = ["slots", "locale", "remote", "remote.credentials", "configForms", "connection"];

    function apply(ctx) {
      const t = ctx.locale.bind(NS);
      ctx.effect(() => ctx.locale.register(NS, dictionaries), "gpt-api: dictionaries");
      ctx.effect(() => {
        const tag = document.createElement("style");
        tag.dataset.plugin = "dsh-gpt-api";
        tag.dataset.pluginCss = "dsh-gpt-api/settings";
        tag.textContent = css;
        document.head.appendChild(tag);
        return () => tag.remove();
      }, "gpt-api: styles");
      const card = new GptApiController(ctx.configForms.get(CONFIG_NS), ctx);
      ctx.effect(() => () => card.dispose(), "gpt-api: form subscription");
      ctx.effect(() => ctx.remote.$on("credentials/reference-updated", (ref) => {
        if (ref === card.ref()) card.readCredential();
      }), "gpt-api: credential invalidations");
      ctx.effect(() => ctx.remote.$on("connection/reset", () => card.readCredential()), "gpt-api: credential reconnect");
      ctx.effect(() => ctx.configForms.whileServed([CONFIG_NS], () => {
        const pages = [
          { name: "plugins.item", id: CONFIG_NS, order: 25, label: () => t("title") },
          { name: "plugins.bundle.config", key: "dsh-gpt-api" },
        ];
        const dispose = pages.map((page) => ctx.slots.inject(page.name, () => ctx.slots.register({
          ...page, locale: NS, inject: () => card.inject(),
        }, GptApiCard)));
        return () => dispose.forEach((off) => off());
      }), "gpt-api: settings pages");
    }

    return { inject, apply };
  },
});
