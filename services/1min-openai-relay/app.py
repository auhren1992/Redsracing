#!/usr/bin/env python3
"""
OpenAI-compatible relay for 1min.ai.

1min.ai does not expose /v1/chat/completions natively. Cursor (and other
OpenAI clients) need this relay so you can use your 1min.ai API key and
access the full model catalog.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import time
import uuid
from io import BytesIO
from typing import Any

import requests
from flask import Flask, Response, jsonify, make_response, request

from models import (
    CHAT_MODELS,
    IMAGE_GENERATION_MODELS,
    MODEL_ALIASES,
    VISION_MODELS,
    resolve_model,
)

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s [1min-relay] %(message)s",
)
logger = logging.getLogger("1min-openai-relay")

app = Flask(__name__)

ONE_MIN_CHAT_URL = "https://api.1min.ai/api/chat-with-ai"
ONE_MIN_CHAT_STREAM_URL = "https://api.1min.ai/api/chat-with-ai?isStreaming=true"
ONE_MIN_FEATURES_URL = "https://api.1min.ai/api/features"
ONE_MIN_ASSETS_URL = "https://api.1min.ai/api/assets"

# Allow any model ID through to 1min.ai (recommended). Set false to restrict
# chat requests to CHAT_MODELS + aliases only.
ALLOW_ALL_MODELS = os.getenv("ALLOW_ALL_MODELS", "true").lower() in {
    "1",
    "true",
    "yes",
    "on",
}

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "5001"))

OPENAI_SIZE_TO_ASPECT_RATIO = {
    "256x256": "1:1",
    "512x512": "1:1",
    "1024x1024": "1:1",
    "1024x1792": "9:16",
    "1792x1024": "16:9",
    "1280x720": "16:9",
    "720x1280": "9:16",
}


def _estimate_tokens(text: str) -> int:
    if not text:
        return 0
    # Rough estimate; Cursor does not require exact billing tokens.
    return max(1, len(text) // 4)


def _extract_api_key() -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.lower().startswith("bearer "):
        return auth.split(" ", 1)[1].strip() or None
    # Some clients send the raw 1min key header.
    return (
        request.headers.get("API-KEY")
        or request.headers.get("Api-Key")
        or request.headers.get("x-api-key")
    )


def _one_min_headers(api_key: str) -> dict[str, str]:
    return {"API-KEY": api_key, "Content-Type": "application/json"}


def _openai_error(
    message: str,
    *,
    err_type: str = "invalid_request_error",
    code: str | None = None,
    status: int = 400,
):
    body = {"error": {"message": message, "type": err_type, "param": None, "code": code}}
    return jsonify(body), status


def _message_text(content: Any) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                parts.append(item.get("text") or "")
            elif isinstance(item, dict) and "text" in item:
                parts.append(item.get("text") or "")
            elif isinstance(item, str):
                parts.append(item)
        return "\n".join(p for p in parts if p)
    return str(content)


def _format_prompt(messages: list[dict[str, Any]]) -> str:
    """Flatten OpenAI chat messages into a single 1min.ai prompt string."""
    if not messages:
        return ""
    if len(messages) == 1:
        return _message_text(messages[0].get("content"))

    lines = ["Conversation History:"]
    for message in messages[:-1]:
        role = (message.get("role") or "user").capitalize()
        lines.append(f"{role}: {_message_text(message.get('content'))}")
    lines.append(
        "Respond like normal. Do not prefix your reply with User: or Assistant:."
    )
    lines.append("User Message:")
    lines.append(_message_text(messages[-1].get("content")))
    return "\n".join(lines)


def _collect_images(
    messages: list[dict[str, Any]], api_key: str, model: str
) -> list[str]:
    """Upload vision image_url parts to 1min.ai assets; return asset paths."""
    image_paths: list[str] = []
    headers = {"API-KEY": api_key}

    for message in messages:
        content = message.get("content")
        if not isinstance(content, list):
            continue
        for item in content:
            if not isinstance(item, dict):
                continue
            image_url = None
            if item.get("type") == "image_url":
                image_url = (item.get("image_url") or {}).get("url")
            elif "image_url" in item:
                image_url = (item.get("image_url") or {}).get("url")
            if not image_url:
                continue
            if model not in VISION_MODELS and not ALLOW_ALL_MODELS:
                raise ValueError(f"Model {model} does not support image inputs.")

            try:
                if image_url.startswith("data:image/"):
                    header, b64 = image_url.split(",", 1)
                    mime = header.split(";")[0].split(":")[1]
                    binary = base64.b64decode(b64)
                else:
                    if not image_url.startswith("https://"):
                        raise ValueError("Only HTTPS image URLs are allowed.")
                    img_resp = requests.get(image_url, timeout=20)
                    img_resp.raise_for_status()
                    mime = img_resp.headers.get("Content-Type", "image/png").split(";")[
                        0
                    ]
                    binary = img_resp.content

                files = {
                    "asset": (f"relay-{uuid.uuid4()}.img", BytesIO(binary), mime)
                }
                asset = requests.post(
                    ONE_MIN_ASSETS_URL, files=files, headers=headers, timeout=60
                )
                asset.raise_for_status()
                path = asset.json()["fileContent"]["path"]
                image_paths.append(path)
            except Exception as exc:  # noqa: BLE001
                logger.error("Image upload failed: %s", exc)
                raise

    return image_paths


def _size_to_aspect_ratio(size_str: str) -> str:
    if size_str in OPENAI_SIZE_TO_ASPECT_RATIO:
        return OPENAI_SIZE_TO_ASPECT_RATIO[size_str]
    if "x" in size_str.lower():
        try:
            from math import gcd

            w, h = map(int, size_str.lower().split("x"))
            g = gcd(w, h)
            return f"{w // g}:{h // g}"
        except (ValueError, ZeroDivisionError):
            pass
    return "1:1"


def _cors(resp: Response) -> Response:
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization,API-KEY"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return resp


@app.after_request
def after_request(resp):
    return _cors(resp)


@app.route("/", methods=["GET"])
def index():
    return (
        "1min.ai OpenAI-compatible relay is running.\n"
        f"Use base URL http://127.0.0.1:{PORT}/v1 in Cursor.\n"
        f"Models listed: {len(CHAT_MODELS)} chat + {len(IMAGE_GENERATION_MODELS)} image.\n"
        f"ALLOW_ALL_MODELS={ALLOW_ALL_MODELS}\n"
    )


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "allow_all_models": ALLOW_ALL_MODELS})


@app.route("/v1/models", methods=["GET", "OPTIONS"])
def list_models():
    if request.method == "OPTIONS":
        return make_response("", 204)

    now = int(time.time())
    data = [
        {
            "id": model_id,
            "object": "model",
            "created": now,
            "owned_by": "1min.ai",
        }
        for model_id in CHAT_MODELS + IMAGE_GENERATION_MODELS
    ]
    # Also expose aliases so Cursor model picks show up in verify lists.
    for alias in sorted(MODEL_ALIASES.keys()):
        if alias not in CHAT_MODELS:
            data.append(
                {
                    "id": alias,
                    "object": "model",
                    "created": now,
                    "owned_by": "1min.ai",
                }
            )
    return jsonify({"object": "list", "data": data})


@app.route("/v1/chat/completions", methods=["POST", "OPTIONS"])
def chat_completions():
    if request.method == "OPTIONS":
        return make_response("", 204)

    api_key = _extract_api_key()
    if not api_key:
        return _openai_error(
            "Missing API key. Use Authorization: Bearer <1min.ai API key>.",
            err_type="authentication_error",
            code="invalid_api_key",
            status=401,
        )

    body = request.get_json(silent=True) or {}
    model = resolve_model(body.get("model") or "gpt-4o-mini")
    messages = body.get("messages") or []
    stream = bool(body.get("stream", False))

    if not messages:
        return _openai_error("No messages provided.", code="invalid_request_error")

    if not ALLOW_ALL_MODELS and model not in CHAT_MODELS:
        return _openai_error(
            f"The model `{model}` does not exist or is not enabled on this relay.",
            code="model_not_found",
        )

    try:
        image_paths = _collect_images(messages, api_key, model)
    except ValueError as exc:
        return _openai_error(str(exc), code="invalid_image_url")
    except Exception as exc:  # noqa: BLE001
        return _openai_error(f"Failed to process images: {exc}", status=502)

    prompt = _format_prompt(messages)
    prompt_tokens = _estimate_tokens(prompt)

    prompt_object: dict[str, Any] = {
        "prompt": prompt,
        "isMixed": False,
        "webSearch": bool(body.get("web_search", False)),
    }
    if image_paths:
        prompt_object["attachments"] = {"images": image_paths, "files": []}

    payload = {
        "type": "UNIFY_CHAT_WITH_AI",
        "model": model,
        "promptObject": prompt_object,
    }
    headers = _one_min_headers(api_key)

    logger.info(
        "chat model=%s stream=%s prompt_tokens~=%s images=%s",
        model,
        stream,
        prompt_tokens,
        len(image_paths),
    )

    if not stream:
        try:
            upstream = requests.post(
                ONE_MIN_CHAT_URL, json=payload, headers=headers, timeout=300
            )
        except requests.RequestException as exc:
            logger.error("Upstream request failed: %s", exc)
            return _openai_error(f"Upstream request failed: {exc}", status=502)

        if upstream.status_code == 401:
            return _openai_error(
                "Incorrect API key. Get one at https://app.1min.ai/api",
                err_type="authentication_error",
                code="invalid_api_key",
                status=401,
            )
        if upstream.status_code != 200:
            logger.error(
                "Upstream error status=%s body=%s",
                upstream.status_code,
                upstream.text[:500],
            )
            return _openai_error(
                f"1min.ai error ({upstream.status_code}): {upstream.text[:400]}",
                status=upstream.status_code if upstream.status_code >= 400 else 502,
            )

        try:
            one_min = upstream.json()
            content = one_min["aiRecord"]["aiRecordDetail"]["resultObject"][0]
        except (KeyError, IndexError, TypeError, ValueError) as exc:
            logger.error("Unexpected upstream payload: %s", upstream.text[:500])
            return _openai_error(
                f"Unexpected 1min.ai response shape: {exc}", status=502
            )

        completion_tokens = _estimate_tokens(content)
        return jsonify(
            {
                "id": f"chatcmpl-{uuid.uuid4()}",
                "object": "chat.completion",
                "created": int(time.time()),
                "model": model,
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": content},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "total_tokens": prompt_tokens + completion_tokens,
                },
            }
        )

    # Streaming
    try:
        upstream = requests.post(
            ONE_MIN_CHAT_STREAM_URL,
            json=payload,
            headers=headers,
            stream=True,
            timeout=300,
        )
    except requests.RequestException as exc:
        return _openai_error(f"Upstream request failed: {exc}", status=502)

    if upstream.status_code == 401:
        return _openai_error(
            "Incorrect API key. Get one at https://app.1min.ai/api",
            err_type="authentication_error",
            code="invalid_api_key",
            status=401,
        )
    if upstream.status_code != 200:
        return _openai_error(
            f"1min.ai error ({upstream.status_code}): {upstream.text[:400]}",
            status=upstream.status_code if upstream.status_code >= 400 else 502,
        )

    def generate():
        chunk_id = f"chatcmpl-{uuid.uuid4()}"
        all_chunks = ""
        current_event = None

        for line in upstream.iter_lines(decode_unicode=True):
            if not line:
                current_event = None
                continue
            if line.startswith("event:"):
                current_event = line[len("event:") :].strip()
                continue
            if not line.startswith("data:"):
                continue

            raw = line[len("data:") :].strip()
            if current_event == "content":
                try:
                    text_delta = json.loads(raw).get("content", "")
                except (json.JSONDecodeError, AttributeError):
                    text_delta = raw
                all_chunks += text_delta
                payload_chunk = {
                    "id": chunk_id,
                    "object": "chat.completion.chunk",
                    "created": int(time.time()),
                    "model": model,
                    "choices": [
                        {
                            "index": 0,
                            "delta": {"content": text_delta},
                            "finish_reason": None,
                        }
                    ],
                }
                yield f"data: {json.dumps(payload_chunk)}\n\n"
            elif current_event == "result":
                try:
                    result_obj = (
                        json.loads(raw)
                        .get("aiRecord", {})
                        .get("aiRecordDetail", {})
                        .get("resultObject", [])
                    )
                    if result_obj:
                        all_chunks = result_obj[0]
                except (json.JSONDecodeError, KeyError, IndexError, TypeError):
                    pass
            elif current_event == "error":
                logger.error("1min.ai stream error: %s", raw[:500])

        completion_tokens = _estimate_tokens(all_chunks)
        final_chunk = {
            "id": chunk_id,
            "object": "chat.completion.chunk",
            "created": int(time.time()),
            "model": model,
            "choices": [
                {"index": 0, "delta": {"content": ""}, "finish_reason": "stop"}
            ],
            "usage": {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": prompt_tokens + completion_tokens,
            },
        }
        yield f"data: {json.dumps(final_chunk)}\n\n"
        yield "data: [DONE]\n\n"

    return Response(generate(), content_type="text/event-stream")


@app.route("/v1/images/generations", methods=["POST", "OPTIONS"])
def images_generations():
    if request.method == "OPTIONS":
        return make_response("", 204)

    api_key = _extract_api_key()
    if not api_key:
        return _openai_error(
            "Missing API key. Use Authorization: Bearer <1min.ai API key>.",
            err_type="authentication_error",
            code="invalid_api_key",
            status=401,
        )

    body = request.get_json(silent=True) or {}
    prompt = body.get("prompt")
    if not prompt:
        return _openai_error("No prompt provided.", code="invalid_request_error")

    model = body.get("model", "black-forest-labs/flux-schnell")
    if model not in IMAGE_GENERATION_MODELS and not ALLOW_ALL_MODELS:
        return _openai_error(
            f"Image model `{model}` is not enabled.", code="model_not_found"
        )

    payload = {
        "type": "IMAGE_GENERATOR",
        "model": model,
        "promptObject": {
            "prompt": prompt,
            "num_outputs": int(body.get("n", 1)),
            "aspect_ratio": _size_to_aspect_ratio(body.get("size", "1024x1024")),
            "output_format": "webp",
        },
    }

    try:
        upstream = requests.post(
            ONE_MIN_FEATURES_URL,
            json=payload,
            headers=_one_min_headers(api_key),
            timeout=300,
        )
        upstream.raise_for_status()
        one_min = upstream.json()
        urls = one_min["aiRecord"]["aiRecordDetail"]["resultObject"]
    except Exception as exc:  # noqa: BLE001
        logger.error("Image generation failed: %s", exc)
        return _openai_error(f"Image generation failed: {exc}", status=502)

    return jsonify(
        {"created": int(time.time()), "data": [{"url": url} for url in urls]}
    )


if __name__ == "__main__":
    logger.info(
        "Starting 1min.ai OpenAI relay on %s:%s (ALLOW_ALL_MODELS=%s, models=%s)",
        HOST,
        PORT,
        ALLOW_ALL_MODELS,
        len(CHAT_MODELS),
    )
    # threaded=True so streaming + concurrent Cursor requests work locally.
    app.run(host=HOST, port=PORT, threaded=True)
