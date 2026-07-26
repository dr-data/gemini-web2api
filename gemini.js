// Core Gemini Protocol translation logic

export const MODELS = {
  "gemini-3.6-flash": { mode: 1, think: 4 },
  "gemini-3.5-flash": { mode: 1, think: 4 },
  "gemini-3.5-flash-thinking": { mode: 2, think: 0 },
  "gemini-3.1-pro": { mode: 3, think: 4 },
  "gemini-auto": { mode: 4, think: 4 },
  "gemini-3.5-flash-thinking-lite": { mode: 5, think: 0 },
  "gemini-flash-lite": { mode: 6, think: 4 }
};

export function resolveModel(modelName) {
  let thinkOverride = null;
  if (modelName.includes("@think=")) {
      const parts = modelName.split("@think=");
      modelName = parts[0];
      thinkOverride = parseInt(parts[1], 10);
  }
  const cfg = MODELS[modelName] || MODELS["gemini-3.6-flash"];
  return {
      modelId: cfg.mode,
      thinkMode: thinkOverride !== null ? thinkOverride : cfg.think,
      resolvedName: modelName
  };
}

export function messagesToPrompt(messages) {
  let parts = [];
  for (const msg of messages) {
      const role = msg.role || "user";
      let content = msg.content || "";
      if (Array.isArray(content)) {
          content = content
            .filter(c => c.type === "text" || c.type === "input_text")
            .map(c => c.text)
            .join(" ");
      }
      if (role === "system") {
          parts.push(`[System instruction]: ${content}`);
      } else if (role === "assistant") {
          parts.push(`[Assistant]: ${content}`);
      } else {
          parts.push(content);
      }
  }
  return parts.join("\n\n");
}

export function buildPayload(prompt, modelId, thinkMode) {
  const inner = new Array(102).fill(null);
  inner[0] = [prompt, 0, null, null, null, null, 0];
  inner[1] = ["en"];
  inner[2] = ["", "", "", null, null, null, null, null, null, ""];
  inner[6] = [0];
  inner[7] = 1;
  inner[10] = 1;
  inner[11] = 0;
  inner[17] = [[thinkMode]];
  inner[18] = 0;
  inner[27] = 1;
  inner[30] = [4];
  inner[41] = [2];
  inner[53] = 0;
  inner[59] = crypto.randomUUID();
  inner[61] = [];
  inner[68] = 1;
  inner[79] = modelId;

  return JSON.stringify([null, JSON.stringify(inner)]);
}

export function cleanText(text) {
  text = text.replace(/```(?:python|javascript|text)\?code_(?:reference|stdout)&code_event_index=\d+\n[\s\S]*?```\n?/g, '');
  text = text.replace(/http:\/\/googleusercontent\.com\/card_content\/\d+\n?/g, '');
  return text.trim();
}

export function extractTextsFromLine(line) {
  if (!line.includes('"wrb.fr"') || line.length < 200) return [];
  try {
      const arr = JSON.parse(line);
      const innerStr = arr[0][2];
      if (!innerStr || innerStr.length < 50) return [];
      const inner = JSON.parse(innerStr);
      if (!Array.isArray(inner) || inner.length <= 4 || !inner[4]) return [];

      const texts = [];
      for (const part of inner[4]) {
          if (Array.isArray(part) && part.length > 1 && Array.isArray(part[1])) {
              for (const t of part[1]) {
                  if (typeof t === 'string' && t.length > 0) {
                      texts.push(t);
                  }
              }
          }
      }
      return texts;
  } catch (e) {
      return [];
  }
}
