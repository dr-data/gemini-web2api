import http from 'http';
import https from 'https';
import crypto from 'crypto';
import { resolveModel, messagesToPrompt, buildPayload, extractTextsFromLine, cleanText } from './gemini.js';

const PORT = process.env.PORT || 8081;
const COOKIE = process.env.GEMINI_COOKIE || "";
let sapisid = "";
if (COOKIE) {
    const match = COOKIE.match(/SAPISID=([^;]+)/);
    if (match) sapisid = match[1];
}

function makeSapisidHash(sapisid) {
    if (!sapisid) return "";
    const ts = Math.floor(Date.now() / 1000);
    const str = `${ts} ${sapisid} https://gemini.google.com`;
    const hash = crypto.createHash('sha1').update(str).digest('hex');
    return `SAPISIDHASH ${ts}_${hash}`;
}

export const server = http.createServer((req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/v1/chat/completions') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const payload = JSON.parse(body);
                await handleChat(req, res, payload);
            } catch (e) {
                console.error(e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: { message: e.toString() } }));
            }
        });
    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "not found" }));
    }
});

async function handleChat(req, res, payload) {
    const modelInfo = resolveModel(payload.model || "gemini-3.6-flash");
    const prompt = messagesToPrompt(payload.messages || []);
    const fReq = buildPayload(prompt, modelInfo.modelId, modelInfo.thinkMode);

    const reqid = Math.floor(Date.now() / 1000) % 1000000;
    const url = new URL(`https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?bl=boq_assistant-bard-web-server_20260716.08_p0&hl=en&_reqid=${reqid}&rt=c`);

    const params = new URLSearchParams();
    params.append("f.req", fReq);

    const headers = {
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": "https://gemini.google.com",
        "Referer": "https://gemini.google.com/app",
        "X-Same-Domain": "1",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    };
    if (COOKIE) {
        headers["Cookie"] = COOKIE;
        headers["Authorization"] = makeSapisidHash(sapisid);
    }

    const options = {
        method: 'POST',
        headers: headers
    };
    const cid = `chatcmpl-${crypto.randomUUID().slice(0, 12)}`;

    // Try fetching XSRF token if running in an environment where we can request it
    try {
        const tokenReq = https.request('https://gemini.google.com/app', { headers: { Cookie: COOKIE } }, (tokenRes) => {
            let tokenData = '';
            tokenRes.on('data', chunk => tokenData += chunk.toString());
            tokenRes.on('end', () => {
                const match = tokenData.match(/"SNlM0e":"([^"]+)"/);
                if (match) {
                    params.append("at", match[1]);
                }
                executeGeminiRequest(url, options, params, res, payload, modelInfo, cid);
            });
        });
        tokenReq.on('error', (e) => {
            console.error('Failed to fetch token:', e);
            executeGeminiRequest(url, options, params, res, payload, modelInfo, cid);
        });
        tokenReq.end();
    } catch(e) {
        // Fallback without XSRF token
        executeGeminiRequest(url, options, params, res, payload, modelInfo, cid);
    }
}


export function executeGeminiRequest(url, options, params, res, payload, modelInfo, cid) {
    const clientReq = https.request(url, options, (clientRes) => {
        if (clientRes.statusCode !== 200) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: { message: `Upstream returned ${clientRes.statusCode}` } }));
            return;
        }

        if (payload.stream) {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });

            let prevText = "";
            let buf = "";

            clientRes.on('data', (chunk) => {
                buf += chunk.toString('utf-8');
                let parts = buf.split("\n");
                buf = parts.pop();

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
                                res.write(`data: ${JSON.stringify(chunkObj)}\n\n`);
                            }
                            prevText = t;
                        }
                    }
                }
            });

            clientRes.on('end', () => {
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
                                res.write(`data: ${JSON.stringify(chunkObj)}\n\n`);
                            }
                        }
                    }
                }
                const endObj = {
                    id: cid, object: "chat.completion.chunk", created: Math.floor(Date.now()/1000),
                    model: modelInfo.resolvedName, choices: [{ index: 0, delta: {}, finish_reason: "stop" }]
                };
                res.write(`data: ${JSON.stringify(endObj)}\n\ndata: [DONE]\n\n`);
                res.end();
            });

        } else {
            let raw = '';
            clientRes.on('data', chunk => raw += chunk.toString('utf-8'));
            clientRes.on('end', () => {
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

                const responseObj = {
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
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(responseObj));
            });
        }
    });

    clientReq.on('error', (e) => {
        console.error(e);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: e.toString() } }));
    });

    clientReq.write(params.toString());
    clientReq.end();
}

if (process.argv[1] && process.argv[1].endsWith('server.js')) {
    server.listen(PORT, () => {
        console.log(`js-server listening on http://localhost:${PORT}`);
    });
}
