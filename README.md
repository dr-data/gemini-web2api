# gemini-web2api

Convert Google Gemini's web interface into an OpenAI-compatible API without needing a Python server.
This repository provides two serverless/lightweight approaches:

## Option 1: Chrome Extension Interceptor

The extension allows you to use web-based Chat UIs (like online chat clients) to talk to Gemini without setting up any local server.
It works by intercepting network requests to a dummy API URL and redirecting them to your active Gemini Web session securely.

1. Go to `chrome://extensions/` and enable "Developer mode".
2. Click "Load unpacked" and select the `extension/` folder from this repository.
3. Open your web-based Chat UI and configure it:
   - **Base URL:** `https://api.gemini.local/v1` (or `http://api.gemini.local/v1`)
   - **API Key:** `sk-any-random-key`
   - **Model:** `gemini-3.6-flash` (or any other supported model)
4. Ensure you are logged into `https://gemini.google.com` in another tab.

## Option 2: Lightweight Pure JavaScript Server (Node.js)

If you are using desktop clients (like ChatBox, Cherry Studio, or `curl`), you can run the lightweight, zero-dependency Node.js server.

1. CD into the `js-server/` directory.
2. Provide your Gemini cookie string via environment variable `GEMINI_COOKIE` (Optional for basic models, required for Pro/Advanced routing).
3. Run the server:
   ```bash
   node server.js
   ```
4. Point your desktop client to `http://localhost:8081/v1`.

### Fetching your Cookie
1. Go to `https://gemini.google.com`
2. Open Developer Tools (F12) -> Application -> Cookies
3. Copy the values of `SID`, `HSID`, `SSID`, `APISID`, `SAPISID`, and `__Secure-1PSID`. Format them as a standard cookie string: `SID=...; HSID=...; SAPISID=...;`
