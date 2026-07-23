const originalFetch = window.fetch;

window.fetch = async function(...args) {
    let url = args[0];
    if (typeof url === 'object' && url.url) {
        url = url.url;
    }

    // Intercept requests to our dummy API url
    if (url && (url.includes("api.gemini.local/v1/chat/completions") || url.includes("api.openai.local/v1/chat/completions"))) {
        const options = args[1] || {};
        let body;
        try {
            body = JSON.parse(options.body);
        } catch(e) {
            return new Response(JSON.stringify({error: {message: "Invalid JSON"}}), {status: 400});
        }

        const id = crypto.randomUUID();
        const secret = window.__GEMINI_WEB2API_SECRET__;

        return new Promise((resolve) => {
            const stream = body.stream;

            if (stream) {
                // Setup stream handler
                const { readable, writable } = new TransformStream();
                const writer = writable.getWriter();
                const encoder = new TextEncoder();

                const listener = (event) => {
                    if (event.source !== window || !event.data || event.data.source !== "gemini-web2api-content") return;

                    if (event.data.id === id && event.data.type === "STREAM_CHUNK") {
                        if (event.data.error) {
                            writer.close();
                            window.removeEventListener("message", listener);
                        } else if (event.data.done) {
                            writer.close();
                            window.removeEventListener("message", listener);
                        } else {
                            writer.write(encoder.encode(event.data.chunk));
                        }
                    }
                };
                window.addEventListener("message", listener);

                window.postMessage({
                    source: "gemini-web2api-inject",
                    type: "REQUEST_GEMINI",
                    id: id,
                    payload: body,
                    secret: secret
                }, "*");

                resolve(new Response(readable, {
                    headers: { 'Content-Type': 'text/event-stream' }
                }));

            } else {
                // Non-streaming handler
                const listener = (event) => {
                    if (event.source !== window || !event.data || event.data.source !== "gemini-web2api-content") return;

                    if (event.data.id === id && event.data.type === "RESPONSE_GEMINI") {
                        window.removeEventListener("message", listener);
                        const respData = event.data.response;
                        resolve(new Response(JSON.stringify(respData), {
                            headers: { 'Content-Type': 'application/json' },
                            status: respData.error ? 500 : 200
                        }));
                    }
                };
                window.addEventListener("message", listener);

                window.postMessage({
                    source: "gemini-web2api-inject",
                    type: "REQUEST_GEMINI",
                    id: id,
                    payload: body,
                    secret: secret
                }, "*");
            }
        });
    }

    return originalFetch.apply(this, args);
};
