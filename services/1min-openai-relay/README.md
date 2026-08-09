# 1min.ai → OpenAI relay (for Cursor)

1min.ai’s API is **not** OpenAI-compatible. Pointing Cursor’s “Override OpenAI Base URL” at `https://api.1min.ai` will fail.

This relay speaks OpenAI’s `/v1/models` and `/v1/chat/completions` format and forwards to 1min.ai’s Chat with AI API, with **all models allowed by default**.

## Quick start

### Option A — Docker (recommended)

```bash
cd services/1min-openai-relay
docker compose up -d --build
curl http://127.0.0.1:5001/v1/models
```

### Option B — Python locally

```bash
cd services/1min-openai-relay
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Relay listens on `http://127.0.0.1:5001`.

## Cursor setup

1. Open **Cursor Settings → Models**
2. Enable **OpenAI API Key** and paste your **1min.ai API key** from https://app.1min.ai/api
3. Enable **Override OpenAI Base URL**
4. Set base URL to:

   ```text
   http://127.0.0.1:5001/v1
   ```

5. Click **+ Add model** and add the exact 1min.ai model IDs you want, for example:
   - `gpt-5.4`
   - `claude-sonnet-4-6`
   - `claude-opus-4-6`
   - `gemini-2.5-pro`
   - `deepseek-chat`
   - `grok-4-0709`
   - `qwen3-coder-plus`
6. Click **Verify**
7. If verify fails with a connection/protocol error, set **Cursor Settings → Network → HTTP Compatibility Mode** to **HTTP/1.1**

Full catalog is in `models.py` and also returned by `GET /v1/models`.

## Why “all AIs” were blocked before

Common failure modes:

| Mistake | Result |
|---|---|
| Base URL = `https://api.1min.ai` | 404 / wrong API shape (not OpenAI) |
| Base URL missing `/v1` | Cursor hits the wrong path |
| Relay with `PERMIT_MODELS_FROM_SUBSET_ONLY=true` | Only 2–3 models work |
| Outdated relay model list | Newer Claude / GPT / Gemini IDs rejected |
| HTTP/2 to a local relay | Connection errors in Cursor |

This relay sets `ALLOW_ALL_MODELS=true`, so unknown/new 1min.ai model IDs are still forwarded.

## Test with curl

```bash
export ONEMIN_API_KEY="your-1min-api-key"

curl -s http://127.0.0.1:5001/v1/models | head

curl -s http://127.0.0.1:5001/v1/chat/completions \
  -H "Authorization: Bearer $ONEMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-6",
    "messages": [{"role":"user","content":"Say hello in one short sentence."}]
  }'
```

## Security notes

- Keep the relay on localhost unless you put it behind auth/TLS.
- Never commit your 1min.ai API key.
- The key is sent as `Authorization: Bearer …` to the relay; the relay converts it to 1min.ai’s `API-KEY` header.
