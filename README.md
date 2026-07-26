# gemini-web2api

Convert Google Gemini's web interface into an OpenAI-compatible API using a lightweight Pure JavaScript Server (Node.js).

This provides a zero-dependency server that intercepts OpenAI format requests and securely proxies them to Google Gemini's internal web endpoints using your browser session cookie.

## Features
- **Zero Dependencies**: Pure JavaScript, only requires Node.js standard library.
- **OpenAI Compatible**: Drop-in replacement for `/v1/chat/completions`.
- **Multiple Models**: Flash (3.6), Extended Thinking, Auto, Lite.
- **Streaming**: Server-Sent Events (SSE) stream support out-of-the-box.

## Prerequisites
- [Node.js](https://nodejs.org/en/) installed on your machine.
- Your Gemini Web session cookie (see instructions below).

## Installation & Usage

1. **Clone the repository:**
   ```
   git clone https://github.com/lsdefine/gemini-web2api.git
   cd gemini-web2api
   ```

2. **Fetch your Gemini Cookie:**
   - Go to [gemini.google.com](https://gemini.google.com) and sign in.
   - Open your browser's Developer Tools (F12) -> Application -> Cookies -> `https://gemini.google.com`.
   - Copy the values of `SID`, `HSID`, `SSID`, `APISID`, `SAPISID`, and `__Secure-1PSID`.
   - Format them into a single string like this:
     ```
     SID=value; HSID=value; SAPISID=value; ...
     ```

3. **Start the server:**
   Set the `GEMINI_COOKIE` environment variable and run the server script.

   *Linux/macOS:*
   ```
   GEMINI_COOKIE="your_cookie_string_here" node server.js
   ```

   *Windows (PowerShell):*
   ```
   $env:GEMINI_COOKIE="your_cookie_string_here"
   node server.js
   ```

   The server will start listening on `http://localhost:8081`. You can override the port using the `PORT` environment variable.

## Client Configuration

### ChatBox / Cherry Studio / OpenAI Clients
- **API URL (Base URL):** `http://localhost:8081/v1`
- **API Key:** `sk-any-key` (It's ignored by the server, but clients usually require one)
- **Model:** `gemini-3.6-flash` (or `gemini-3.5-flash-thinking`)

### Using cURL
```
curl http://localhost:8081/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-3.6-flash",
    "messages": [{"role": "user", "content": "Explain quantum computing in one sentence"}],
    "stream": true
  }'
```

## Available Models
- `gemini-3.6-flash`
- `gemini-3.5-flash`
- `gemini-3.5-flash-thinking`
- `gemini-auto`
- `gemini-flash-lite`

You can append `@think=N` to models to control thinking depth (e.g. `gemini-3.5-flash-thinking@think=0` is deepest, `4` is shallowest).

## Limitations
This simplified JavaScript implementation currently lacks support for Image Uploading (multimodal) and Tool Calling (function calling) that were present in earlier Python versions of this tool.
