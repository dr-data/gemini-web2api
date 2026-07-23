// Inject a script into the page context to override window.fetch
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.onload = function() {
    this.remove();
};
(document.head || document.documentElement).appendChild(script);

// Secret token to prevent malicious websites from using the proxy
const secretToken = crypto.randomUUID();

// We need to inject the secret token so inject.js knows it
const tokenScript = document.createElement('script');
tokenScript.textContent = `window.__GEMINI_WEB2API_SECRET__ = "${secretToken}";`;
(document.head || document.documentElement).appendChild(tokenScript);
tokenScript.remove();


// Listen for messages from the injected script and forward them to the background script
window.addEventListener("message", (event) => {
    // We only accept messages from ourselves
    if (event.source !== window || !event.data || event.data.source !== "gemini-web2api-inject") {
        return;
    }

    if (event.data.secret !== secretToken) {
        console.warn("Invalid secret token for Gemini Web2API request");
        return;
    }

    if (event.data.type === "REQUEST_GEMINI") {
        chrome.runtime.sendMessage(
            { type: "EXECUTE_GEMINI", id: event.data.id, payload: event.data.payload },
            (response) => {
                window.postMessage({
                    source: "gemini-web2api-content",
                    type: "RESPONSE_GEMINI",
                    id: event.data.id,
                    response: response
                }, "*");
            }
        );
    }
});

// For streaming, background script uses a port
chrome.runtime.onConnect.addListener((port) => {
    port.onMessage.addListener((msg) => {
        window.postMessage({
            source: "gemini-web2api-content",
            type: "STREAM_CHUNK",
            id: msg.id,
            chunk: msg.chunk,
            done: msg.done,
            error: msg.error
        }, "*");
    });
});
