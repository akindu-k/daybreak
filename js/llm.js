const SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.131.0/+esm";
const MAX_TOKENS = 32000;

let sdk;

/** Loads the API SDK on first use, so the dashboard works without it. */
async function loadSdk() {
  sdk ??= (await import(SDK_URL)).default;
  return sdk;
}

/** Creates an API client for a key held in this browser. */
async function createClient(apiKey) {
  const Sdk = await loadSdk();
  return new Sdk({ apiKey, dangerouslyAllowBrowser: true });
}

/** Turns SDK and parsing errors into a sentence for the page. */
function describeError(error, Sdk) {
  if (error instanceof Sdk.AuthenticationError) return "The API key was rejected. Update it in Settings.";
  if (error instanceof Sdk.RateLimitError) return "Rate limited by the API. Try again in a minute.";
  if (error instanceof Sdk.BadRequestError) return `The API rejected the request: ${error.message}`;
  if (error instanceof Sdk.APIError) return `API error ${error.status ?? ""}: ${error.message}`;
  return error.message;
}

/** Lists the models this key can use that support structured output, newest first. */
export async function listModels(apiKey) {
  const Sdk = await loadSdk();
  try {
    const client = await createClient(apiKey);
    const models = [];
    for await (const model of client.models.list()) {
      if (model.capabilities?.structured_outputs?.supported) models.push({ id: model.id, name: model.display_name });
    }
    return models;
  } catch (error) {
    throw new Error(describeError(error, Sdk));
  }
}

/** Sends one request whose answer must match a JSON schema, and returns the parsed object. */
export async function generateJson({ apiKey, model }, { system, prompt, schema }) {
  const Sdk = await loadSdk();
  try {
    const client = await createClient(apiKey);
    const message = await client.messages
      .stream({
        model,
        max_tokens: MAX_TOKENS,
        system,
        messages: [{ role: "user", content: prompt }],
        output_config: { format: { type: "json_schema", schema } },
      })
      .finalMessage();
    if (message.stop_reason === "refusal") throw new Error("The model declined this request.");
    if (message.stop_reason === "max_tokens") throw new Error("The answer was cut off before it finished. Try again.");
    const text = message.content.find((block) => block.type === "text")?.text;
    if (!text) throw new Error("The model returned no answer.");
    return JSON.parse(text);
  } catch (error) {
    throw new Error(describeError(error, Sdk));
  }
}
