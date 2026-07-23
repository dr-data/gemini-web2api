import { resolveModel, messagesToPrompt, buildPayload, extractTextsFromLine, cleanText } from './gemini.js';

async function fetchXsrfToken() {
    try {
        const res = await fetch("https://gemini.google.com/app", { credentials: "include" });
        const text = await res.text();
        const match = text.match(/"SNlM0e":"([^"]+)"/);
        if (match) {
            return match[1];
        }
    } catch (e) {
        console.error("Failed to fetch XSRF token:", e);
    }
    return null;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "EXECUTE_GEMINI") {
        const payload = request.payload;

        handleGeminiRequest(payload, sender.tab.id, request.id).then(response => {
            if (!payload.stream) {
                sendResponse(response);
            }
        }).catch(err => {
            if (!payload.stream) {
                sendResponse({ error: { message: err.toString() } });
            }
        });

        // Return true to indicate we will send response asynchronously
        return true;
    }
});

async function handleGeminiRequest(payload, tabId, requestId) {
    const modelInfo = resolveModel(payload.model || "gemini-3.6-flash");
    const prompt = messagesToPrompt(payload.messages || []);
    const fReq = buildPayload(prompt, modelInfo.modelId, modelInfo.thinkMode);

    const xsrfToken = await fetchXsrfToken();
    const reqid = Math.floor(Date.now() / 1000) % 1000000;
    const url = `https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=boq_assistant-bard-web-server_20260716.08_p0&hl=en&_reqid=${reqid}&rt=c`;

    const params = new URLSearchParams();
    params.append("f.req", fReq);
    if (xsrfToken) params.append("at", xsrfToken);

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
        credentials: "include"
    });

    if (!response.ok) {
        throw new Error(`Upstream returned ${response.status}`);
    }

    const cid = `chatcmpl-${crypto.randomUUID().slice(0, 12)}`;

    if (payload.stream) {
        let port;
        try {
             port = chrome.tabs.connect(tabId);
        } catch(e) {
             return; // Tab closed
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let prevText = "";
        let buf = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });

            let parts = buf.split("\n");
            buf = parts.pop(); // keep last incomplete line in buffer

            for (const line of parts) {
                const texts = extractTextsFromLine(line);
                for (const t of texts) {
                    if (t.length > prevText.length) {
                        const delta = cleanText(t.slice(prevText.length));
                        if (delta) {
                            const chunkObj = {
                                id: cid, object: "chat.completion.chunk", created: Math.floor(Date.now()/1000),
                                model: modelInfo.resolvedName, choices: [{ index: 0, delta: { content: delta }, finish_reason: null }]
                            };
                            port.postMessage({ id: requestId, chunk: `data: ${JSON.stringify(chunkObj)}\n\n` });
                        }
                        prevText = t;
                    }
                }
            }
        }

        // flush buffer
        if (buf) {
             const texts = extractTextsFromLine(buf);
             for (const t of texts) {
                 if (t.length > prevText.length) {
                     const delta = cleanText(t.slice(prevText.length));
                     if (delta) {
                         const chunkObj = {
                                id: cid, object: "chat.completion.chunk", created: Math.floor(Date.now()/1000),
                                model: modelInfo.resolvedName, choices: [{ index: 0, delta: { content: delta }, finish_reason: null }]
                            };
                         port.postMessage({ id: requestId, chunk: `data: ${JSON.stringify(chunkObj)}\n\n` });
                     }
                 }
             }
        }

        const endObj = {
            id: cid, object: "chat.completion.chunk", created: Math.floor(Date.now()/1000),
            model: modelInfo.resolvedName, choices: [{ index: 0, delta: {}, finish_reason: "stop" }]
        };
        port.postMessage({ id: requestId, chunk: `data: ${JSON.stringify(endObj)}\n\ndata: [DONE]\n\n` });
        port.postMessage({ id: requestId, done: true });
        return;
    }

    // Non-streaming
    const raw = await response.text();
    let finalContent = "";
    for (const line of raw.split("\n")) {
        const texts = extractTextsFromLine(line);
        for (const t of texts) {
             if (t.length > finalContent.length) {
                 finalContent = t;
             }
        }
    }
    finalContent = cleanText(finalContent);

    return {
        id: cid,
        object: "chat.completion",
        created: Math.floor(Date.now()/1000),
        model: modelInfo.resolvedName,
        choices: [{
            index: 0,
            message: { role: "assistant", content: finalContent },
            finish_reason: "stop"
        }]
    };
}
