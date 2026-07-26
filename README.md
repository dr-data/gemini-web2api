# gemini-web2api

Convert Google Gemini's web interface into an OpenAI-compatible API without needing a Python server.
This repository provides a lightweight Pure JavaScript Server (Node.js). (Note: The Chrome Extension interceptor was removed due to severe browser security constraints regarding CSRF).

## Lightweight Pure JavaScript Server (Node.js)

If you are using desktop clients (like ChatBox, Cherry Studio, or `curl`), you can run the lightweight, zero-dependency Node.js server.

1. CD into the `js-server/` directory.
2. Install Node.js if you don't have it.
3. Provide your Gemini cookie string via environment variable `GEMINI_COOKIE` (Optional for basic models, required for Pro/Advanced routing).
4. Run the server:
   ```bash
   node server.js
   ```
5. Point your desktop client to `http://localhost:8081/v1`.

### Fetching your Cookie
1. Go to `https://gemini.google.com`
2. Open Developer Tools (F12) -> Application -> Cookies
3. Copy the values of `SID`, `HSID`, `SSID`, `APISID`, `SAPISID`, and `__Secure-1PSID`. Format them as a standard cookie string: `SID=...; HSID=...; SAPISID=...;`

### Note on Features
This simplified JavaScript rewrite currently lacks support for Image Uploading (multimodal) and Tool Calling (function calling) that was present in the original Python implementation.
