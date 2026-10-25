// 仆洛宅塔羅 MCP 連接器（tarot.angelz13.com/mcp）
// 計劃書：000_Agent/plans/2026-10-24-塔羅MCP連接器.md（工具規格、協定行為對照表都在那裡）
// 只有 /mcp 會進到這支程式（wrangler.jsonc 的 run_worker_first）；其他路徑原樣交給網站靜態檔

import deck from "../skill/tarot/cards.json" with { type: "json" };

const SERVER_INFO = { name: "puluozhai-tarot", version: "1.0.0" };
const LEGACY_VERSION = "2025-11-25";
const MODERN_VERSION = "2026-07-28";
const PROTOCOL_VERSION_KEY = "io.modelcontextprotocol/protocolVersion";
const CLIENT_CAPABILITIES_KEY = "io.modelcontextprotocol/clientCapabilities";
const SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo";
// 工具清單只在部署時改變：讓客戶端快取一小時、可共用
const CACHE_HINT = { ttlMs: 3600000, cacheScope: "public" };
// 只寫工具怎麼用，不寫語氣、字數、角色（Claude review-criteria.md:45-53、OpenAI mcp-server.md）
const INSTRUCTIONS =
  "Tarot card tools based on the public-domain Rider–Waite–Smith deck (A. E. Waite, 1910). draw_cards draws random cards; get_card_meaning looks up a card the user has drawn themselves. Results contain card data only. Card names are given in Chinese and English.";

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, openWorldHint: false };

const BILINGUAL = {
  type: "object",
  properties: { zh: { type: "string" }, en: { type: "string" } },
  required: ["zh", "en"],
};
const STRINGS = { type: "array", items: { type: "string" } };
const ORIENTATION = { type: "string", enum: ["upright", "reversed"] };
const CARD_PROPERTIES = {
  name: BILINGUAL,
  arcana: {
    type: "object",
    properties: {
      code: { type: "string", enum: ["major", "wands", "cups", "swords", "pentacles"] },
      zh: { type: "string" },
      en: { type: "string" },
    },
    required: ["code", "zh", "en"],
  },
  number: { type: "integer" },
  element: { type: "string" },
  symbolism: { type: "string" },
  image_url: { type: "string", format: "uri" },
};
const CARD_REQUIRED = Object.keys(CARD_PROPERTIES);

const DRAW_OUTPUT = {
  type: "object",
  properties: {
    mode: { type: "string", enum: ["single", "three", "daily"] },
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          position: { anyOf: [BILINGUAL, { type: "null" }] },
          ...CARD_PROPERTIES,
          orientation: ORIENTATION,
          orientation_zh: { type: "string" },
          keywords: STRINGS,
        },
        required: ["position", ...CARD_REQUIRED, "orientation", "orientation_zh", "keywords"],
      },
    },
  },
  required: ["mode", "cards"],
};

const MEANING_OUTPUT = {
  type: "object",
  properties: {
    card: {
      type: "object",
      properties: {
        ...CARD_PROPERTIES,
        orientation: { anyOf: [ORIENTATION, { type: "null" }] },
        upright_keywords: STRINGS,
        reversed_keywords: STRINGS,
      },
      required: [...CARD_REQUIRED, "orientation", "upright_keywords", "reversed_keywords"],
    },
  },
  required: ["card"],
};

const TOOLS = [
  {
    name: "draw_cards",
    title: "Draw tarot cards",
    description:
      "Draws cards at random from the 78-card Rider–Waite–Smith tarot deck and returns each card's names in Chinese and English, its position in the spread, upright or reversed orientation, keywords, symbolism notes, and image URL. Use it for a single-card reading, a past–present–future three-card spread, or a daily card.",
    inputSchema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["single", "three", "daily"] },
        allow_reversed: { type: "boolean", default: true },
      },
      required: ["mode"],
      additionalProperties: false,
    },
    outputSchema: DRAW_OUTPUT,
    annotations: { title: "Draw tarot cards", ...READ_ONLY },
  },
  {
    name: "get_card_meaning",
    title: "Look up a tarot card",
    description:
      "Returns the meaning of one named card from the 78-card Rider–Waite–Smith tarot deck: names in Chinese and English, arcana, element, upright and reversed keywords, symbolism notes, and image URL. Use it when the user has drawn a card themselves, for example from a physical deck, and names it. The card parameter takes the card's official English name, so map other names or languages to it (for example, 愚人 or 愚者 is The Fool).",
    inputSchema: {
      type: "object",
      properties: {
        card: { type: "string", enum: deck.cards.map((c) => c.name_en) },
        orientation: { type: "string", enum: ["upright", "reversed"] },
      },
      required: ["card"],
      additionalProperties: false,
    },
    outputSchema: MEANING_OUTPUT,
    annotations: { title: "Look up a tarot card", ...READ_ONLY },
  },
];

const SITE = "https://tarot.angelz13.com/";

// 位置與牌組名稱沿用網站 index.html 的 POSITIONS／ARCANA_ZH（測試逐字對照）
const POSITIONS = {
  single: [null],
  three: [
    { zh: "過去", en: "Past" },
    { zh: "現在", en: "Present" },
    { zh: "未來", en: "Future" },
  ],
  daily: [null],
};

const ARCANA = {
  major: { zh: "大阿爾克納", en: "Major Arcana" },
  wands: { zh: "小阿爾克納 · 權杖", en: "Minor Arcana · Wands" },
  cups: { zh: "小阿爾克納 · 聖杯", en: "Minor Arcana · Cups" },
  swords: { zh: "小阿爾克納 · 寶劍", en: "Minor Arcana · Swords" },
  pentacles: { zh: "小阿爾克納 · 錢幣", en: "Minor Arcana · Pentacles" },
};

const ORIENTATION_ZH = { upright: "正位", reversed: "逆位" };

// [0, n) 的均勻整數：拒絕取樣，避免取餘數讓前面的數字機率偏高
function cryptoRandomInt(n) {
  const limit = Math.floor(0x100000000 / n) * n;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % n;
}

function cardFields(card) {
  return {
    name: { zh: card.name_zh, en: card.name_en },
    arcana: { code: card.arcana, ...ARCANA[card.arcana] },
    number: card.number,
    element: card.element,
    symbolism: card.symbolism,
    image_url: SITE + card.image,
  };
}

function drawCards(args, randomInt) {
  const positions = POSITIONS[args.mode];
  const allowReversed = args.allow_reversed ?? true;
  const pool = deck.cards.slice();
  const cards = positions.map((position) => {
    const card = pool.splice(randomInt(pool.length), 1)[0];
    const orientation = allowReversed && randomInt(2) === 1 ? "reversed" : "upright";
    return {
      position,
      ...cardFields(card),
      orientation,
      orientation_zh: ORIENTATION_ZH[orientation],
      keywords: orientation === "reversed" ? card.reversed_keywords : card.upright_keywords,
    };
  });
  return { mode: args.mode, cards };
}

function getCardMeaning(args) {
  const card = deck.cards.find((c) => c.name_en === args.card);
  return {
    card: {
      ...cardFields(card),
      orientation: args.orientation ?? null,
      upright_keywords: card.upright_keywords,
      reversed_keywords: card.reversed_keywords,
    },
  };
}

// 錯誤訊息只寫參數名稱與合法值，不回顯傳進來的值（避免把對方塞的字串原樣送回模型）
function describeAllowed(name, property) {
  if (property.type === "boolean") return `Expected true or false for "${name}".`;
  if (property.enum.length > 10) {
    return `"${name}" takes the official English card name, for example The Fool, Ace of Wands, or Queen of Cups.`;
  }
  return `Allowed values for "${name}": ${property.enum.join(", ")}.`;
}

function validateArguments(schema, args) {
  if (args === undefined) args = {};
  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    return "Tool arguments must be an object.";
  }
  const allowed = Object.keys(schema.properties);
  if (Object.keys(args).some((key) => !allowed.includes(key))) {
    return `Unknown parameter. Allowed parameters: ${allowed.join(", ")}.`;
  }
  for (const name of schema.required) {
    if (!(name in args)) return `Missing required parameter "${name}". ${describeAllowed(name, schema.properties[name])}`;
  }
  for (const [name, value] of Object.entries(args)) {
    // 有些模型把沒填的選填欄位送成 null ⇒ 視同沒給（抽牌與查牌都用 ?? 取預設值）
    if (value === null && !schema.required.includes(name)) continue;
    const property = schema.properties[name];
    const ok = property.type === "boolean" ? typeof value === "boolean" : property.enum.includes(value);
    if (!ok) return `Invalid value for "${name}". ${describeAllowed(name, property)}`;
  }
  return null;
}

const RATE_LIMITED = "Too many requests. Please try again in a minute.";

// 限流（Cloudflare ratelimits binding、每個機房各算各的）：只對 ChatGPT 帶匿名使用者 ID 的請求各算各的。
// 沒帶的（含 Claude）不在程式裡限：共用一個桶會讓人每秒打幾次就擋掉同機房所有 Claude 使用者，
// 而程式裡的限流本來就護不住每日額度（請求進來就算一次）⇒ 額度靠 Cloudflare 防火牆的限流規則（計劃書 Step 5）。
// binding 沒設或出錯就放行：限流不是必要防線
async function withinRateLimit(params, env) {
  const subject = params?._meta?.["openai/subject"];
  if (typeof subject !== "string" || subject.length === 0 || subject.length > 256) return true;
  const limiter = env.RATE_LIMIT_USER;
  if (!limiter) return true;
  try {
    const { success } = await limiter.limit({ key: subject });
    return success;
  } catch {
    return true;
  }
}

function toolError(text) {
  return { content: [{ type: "text", text }], isError: true };
}

function toolResult(data) {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
    structuredContent: data,
    isError: false,
  };
}

const MAX_BODY_BYTES = 65536;

// 伺服器對伺服器的連線通常不帶 Origin（沒帶就放行）；帶了就只收這幾個
const ALLOWED_ORIGINS = ["https://claude.ai", "https://chatgpt.com", "https://tarot.angelz13.com"];

class HttpError extends Error {
  constructor(status, code, message, logCode) {
    super(message);
    this.status = status;
    this.code = code;
    this.logCode = logCode;
  }
}

// 出錯紀錄只記「哪個動作、哪種錯」，不記參數、不記朋友打的字（計劃書第 1 輪處理紀錄 應2）
const KNOWN_METHODS = ["initialize", "ping", "tools/list", "tools/call", "server/discover", "notifications/initialized"];

function actionOf(message) {
  return KNOWN_METHODS.includes(message.method) ? message.method : "unknown";
}

function defaultLog(entry) {
  console.error(JSON.stringify({ event: "mcp_failure", ...entry }));
}

// 邊讀邊算大小，超過上限就停，不把整個大 body 讀進記憶體
async function readBody(request) {
  if (Number(request.headers.get("Content-Length")) > MAX_BODY_BYTES) {
    throw new HttpError(413, -32000, "Payload too large.", "payload_too_large");
  }
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new HttpError(413, -32000, "Payload too large.", "payload_too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function parseMessage(request) {
  // 比完整的 media type（切掉 ; 後面的 charset 等參數），application/jsonx 這類不算
  const mediaType = (request.headers.get("Content-Type") ?? "").split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    throw new HttpError(415, -32000, "Unsupported Media Type: Content-Type must be application/json.", "unsupported_media_type");
  }
  let message;
  try {
    message = JSON.parse(await readBody(request));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, -32700, "Parse error: invalid JSON.", "parse_error");
  }
  if (typeof message !== "object" || message === null || Array.isArray(message) || message.jsonrpc !== "2.0") {
    throw new HttpError(400, -32600, "Invalid Request: the body must be a single JSON-RPC 2.0 message.", "invalid_request");
  }
  // id 只收字串或整數（不可為 null）；其他型別不回顯、回應的 id 一律 null
  if ("id" in message && typeof message.id !== "string" && !Number.isInteger(message.id)) {
    throw new HttpError(400, -32600, "Invalid Request: id must be a string or an integer.", "invalid_request");
  }
  return message;
}

// Mcp-Name 可能是 =?base64?…?= 格式（streamable-http.md 的 Value Encoding）；解不開就回 null、比對自然不通過
function decodeHeaderValue(value) {
  if (value === null) return null;
  const encoded = /^=\?base64\?(.*)\?=$/.exec(value);
  if (!encoded) return value;
  try {
    const binary = atob(encoded[1]);
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)));
  } catch {
    return null;
  }
}

function errorResponse(id, code, message, status, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return jsonResponse({ jsonrpc: "2.0", id: id ?? null, error }, status);
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function legacyInitialize() {
  return {
    protocolVersion: LEGACY_VERSION,
    capabilities: { tools: {} },
    serverInfo: SERVER_INFO,
    instructions: INSTRUCTIONS,
  };
}

export function createWorker({ randomInt = cryptoRandomInt, log = defaultLog } = {}) {
  async function callTool(params, env) {
    const tool = TOOLS.find((t) => t.name === params?.name);
    if (!tool) {
      log({ action: "tools/call", code: "unknown_tool" });
      return { error: { code: -32602, message: "Unknown tool." } };
    }
    if (!(await withinRateLimit(params, env))) {
      log({ action: tool.name, code: "rate_limited" });
      return { result: toolError(RATE_LIMITED) };
    }
    const problem = validateArguments(tool.inputSchema, params.arguments);
    if (problem) {
      log({ action: tool.name, code: "invalid_params" });
      return { result: toolError(problem) };
    }
    const args = params.arguments;
    if (tool.name === "get_card_meaning") return { result: toolResult(getCardMeaning(args)) };
    return { result: toolResult(drawCards(args, randomInt)) };
  }

  // 回 { result } 或 { error }
  async function dispatch(message, env) {
    switch (message.method) {
      case "initialize":
        return { result: legacyInitialize() };
      case "ping":
        return { result: {} };
      case "tools/list":
        return { result: { tools: TOOLS } };
      case "tools/call":
        return callTool(message.params, env);
      default:
        return methodNotFound();
    }
  }

  function methodNotFound() {
    log({ action: "unknown", code: "method_not_found" });
    return { error: { code: -32601, message: "Method not found." } };
  }

  function rejected(message, code, rpcCode, text, status, data) {
    log({ action: actionOf(message), code });
    return errorResponse(message.id, rpcCode, text, status, data);
  }

  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (url.pathname !== "/mcp") return env.ASSETS.fetch(request);
      const context = { action: "http", id: null };
      try {
        return await handleMcp(request, env, context);
      } catch {
        // 不把錯誤內容回給對方，也不寫進紀錄（訊息裡可能有傳進來的資料）
        log({ action: context.action, code: "exception" });
        return errorResponse(context.id, -32603, "Internal error.", 500);
      }
    },
  };

  async function handleMcp(request, env, context) {
    // OPTIONS／HEAD 也走這裡回 405：不發 CORS 標頭，瀏覽器網頁讀不到回應
    if (request.method !== "POST") {
      return new Response(null, { status: 405, headers: { Allow: "POST" } });
    }
    const origin = request.headers.get("Origin");
    if (origin !== null && !ALLOWED_ORIGINS.includes(origin)) {
      log({ action: "http", code: "forbidden_origin" });
      return errorResponse(null, -32000, "Forbidden origin.", 403);
    }
    let message;
    try {
      message = await parseMessage(request);
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      log({ action: "http", code: error.logCode });
      return errorResponse(null, error.code, error.message, error.status);
    }
    context.action = actionOf(message);
    context.id = message.id ?? null;
    // 帶了 _meta 版本欄位＝新版（每個請求自帶版本）；沒帶＝舊版（initialize 握手）
    const meta = message.params?._meta;
    if (meta && typeof meta === "object" && PROTOCOL_VERSION_KEY in meta) return handleModern(request, message, meta, env);
    return handleLegacy(request, message, env);
  }

  async function handleLegacy(request, message, env) {
    // 通知什麼都不做 ⇒ 不看版本標頭、直接 202（漏帶標頭的客戶端才不會在連線階段就失敗）
    if (!("id" in message)) return new Response(null, { status: 202 });
    // 舊版（2025-11-25）：initialize 之後每個請求都要帶版本標頭
    if (message.method !== "initialize" && request.headers.get("MCP-Protocol-Version") !== LEGACY_VERSION) {
      return rejected(message, "unsupported_version", -32000, "Bad Request: unsupported protocol version.", 400);
    }
    return jsonResponse({ jsonrpc: "2.0", id: message.id, ...(await dispatch(message, env)) });
  }

  async function handleModern(request, message, meta, env) {
    const version = meta[PROTOCOL_VERSION_KEY];
    const capabilities = meta[CLIENT_CAPABILITIES_KEY];
    if (typeof version !== "string" || typeof capabilities !== "object" || capabilities === null) {
      return rejected(message, "invalid_meta", -32602, "Invalid params: missing required _meta fields.", 400);
    }
    const headers = request.headers;
    const nameMismatch = message.method === "tools/call" && decodeHeaderValue(headers.get("Mcp-Name")) !== message.params?.name;
    if (headers.get("MCP-Protocol-Version") !== version || headers.get("Mcp-Method") !== message.method || nameMismatch) {
      return rejected(message, "header_mismatch", -32020, "Header mismatch: MCP headers must match the request body.", 400);
    }
    if (version !== MODERN_VERSION) {
      // requested 是對方傳來的字串 ⇒ 只有長得像版本日期才帶回，其他不回顯
      const data = { supported: [MODERN_VERSION, LEGACY_VERSION] };
      if (/^\d{4}-\d{2}-\d{2}$/.test(version)) data.requested = version;
      return rejected(message, "unsupported_version", -32022, "Unsupported protocol version", 400, data);
    }
    if (!("id" in message)) return new Response(null, { status: 202 });
    const outcome = await dispatchModern(message, env);
    if (outcome.error) {
      const status = outcome.error.code === -32601 ? 404 : 200;
      return jsonResponse({ jsonrpc: "2.0", id: message.id, ...outcome }, status);
    }
    const result = { resultType: "complete", ...outcome.result, _meta: { [SERVER_INFO_KEY]: SERVER_INFO } };
    return jsonResponse({ jsonrpc: "2.0", id: message.id, result });
  }

  async function dispatchModern(message, env) {
    switch (message.method) {
      case "server/discover":
        return {
          result: {
            supportedVersions: [MODERN_VERSION, LEGACY_VERSION],
            capabilities: { tools: {} },
            instructions: INSTRUCTIONS,
            ...CACHE_HINT,
          },
        };
      case "tools/list":
        return { result: { tools: TOOLS, ...CACHE_HINT } };
      case "tools/call":
        return callTool(message.params, env);
      default:
        return methodNotFound();
    }
  }
}

export default createWorker();
