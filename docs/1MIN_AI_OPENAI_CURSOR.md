# Fix: use all 1min.ai models from Cursor’s OpenAI API settings

## Problem

Cursor’s **OpenAI API Key + Override OpenAI Base URL** expects an OpenAI-compatible server (`/v1/models`, `/v1/chat/completions`).

1min.ai exposes a different API (`https://api.1min.ai/api/chat-with-ai`), so pointing Cursor at 1min.ai directly does not unlock those models.

## Fix in this repo

Use the local relay:

`services/1min-openai-relay`

It:

- translates OpenAI requests → 1min.ai Chat with AI
- lists the full current model catalog
- **allows every model ID by default** (`ALLOW_ALL_MODELS=true`)

## Steps

1. Start the relay (`docker compose up -d --build` in `services/1min-openai-relay`)
2. In Cursor Models settings:
   - OpenAI API key = your 1min.ai key
   - Base URL = `http://127.0.0.1:5001/v1`
   - Add each model ID you want (e.g. `claude-sonnet-4-6`, `gpt-5.4`)
3. If needed, set Network HTTP Compatibility Mode to HTTP/1.1

See `services/1min-openai-relay/README.md` for details and curl tests.
