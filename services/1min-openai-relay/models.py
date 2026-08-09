"""Full 1min.ai chat model catalog for OpenAI-compatible listing.

Model IDs match 1min.ai's Chat with AI API (`/api/chat-with-ai`).
Unknown model IDs are still forwarded when ALLOW_ALL_MODELS is true.
"""

# Current chat catalog (aligned with llm-1minai / 1min.ai public model list).
CHAT_MODELS = [
    # OpenAI
    "gpt-3.5-turbo",
    "gpt-4-turbo",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "gpt-4o-mini",
    "gpt-4o",
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-5-chat-latest",
    "gpt-5.1",
    "gpt-5.1-codex",
    "gpt-5.1-codex-mini",
    "gpt-5.2",
    "gpt-5.2-pro",
    "gpt-5.4",
    "gpt-5.4-mini",
    "gpt-5.4-nano",
    "gpt-5.4-pro",
    "o3",
    "o3-mini",
    "o3-pro",
    "o3-deep-research",
    "o4-mini",
    "o4-mini-deep-research",
    # Anthropic
    "claude-sonnet-4-20250514",
    "claude-sonnet-4-5-20250929",
    "claude-sonnet-4-6",
    "claude-opus-4-20250514",
    "claude-opus-4-1-20250805",
    "claude-opus-4-5-20251101",
    "claude-opus-4-6",
    "claude-haiku-4-5-20251001",
    # Google
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-3.1-pro-preview",
    # Alibaba / Qwen
    "qwen-flash",
    "qwen-plus",
    "qwen-max",
    "qwen-vl-plus",
    "qwen-vl-max",
    "qwen3-max",
    "qwen3-vl-flash",
    "qwen3-vl-plus",
    "qwen3-coder-plus",
    "qwen3-coder-flash",
    # DeepSeek
    "deepseek-chat",
    "deepseek-reasoner",
    # xAI
    "grok-3",
    "grok-3-mini",
    "grok-4-0709",
    "grok-4-fast-non-reasoning",
    "grok-4-fast-reasoning",
    "grok-code-fast-1",
    # Mistral
    "open-mistral-nemo",
    "mistral-nemo",
    "mistral-small-latest",
    "mistral-medium-latest",
    "mistral-large-latest",
    "magistral-small-latest",
    "magistral-medium-latest",
    "ministral-14b-latest",
    # Cohere
    "command-r-08-2024",
    "command",
    # Meta / open source
    "meta/llama-2-70b-chat",
    "meta/meta-llama-3-70b-instruct",
    "meta/llama-4-scout-instruct",
    "meta/llama-4-maverick-instruct",
    "openai/gpt-oss-20b",
    "openai/gpt-oss-120b",
    # Perplexity
    "sonar",
    "sonar-pro",
    "sonar-reasoning-pro",
    "sonar-deep-research",
]

IMAGE_GENERATION_MODELS = [
    "stable-image",
    "stable-diffusion-xl-1024-v1-0",
    "stable-diffusion-v1-6",
    "esrgan-v1-x2plus",
    "clipdrop",
    "midjourney",
    "midjourney_6_1",
    "black-forest-labs/flux-schnell",
]

VISION_MODELS = {
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-4.1",
    "gpt-4.1-mini",
    "gpt-4.1-nano",
    "gpt-5",
    "gpt-5-mini",
    "gpt-5-nano",
    "gpt-5.1",
    "gpt-5.2",
    "gpt-5.4",
    "gpt-5.4-mini",
    "gpt-5.4-nano",
    "claude-sonnet-4-20250514",
    "claude-sonnet-4-5-20250929",
    "claude-sonnet-4-6",
    "claude-opus-4-20250514",
    "claude-opus-4-1-20250805",
    "claude-opus-4-5-20251101",
    "claude-opus-4-6",
    "claude-haiku-4-5-20251001",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-3-flash-preview",
    "gemini-3.1-flash-lite-preview",
    "gemini-3.1-pro-preview",
    "qwen-vl-plus",
    "qwen-vl-max",
    "qwen3-vl-flash",
    "qwen3-vl-plus",
}

# Friendly aliases users might type in Cursor's model list.
MODEL_ALIASES = {
    "mistral-nemo": "open-mistral-nemo",
    "claude-4-sonnet": "claude-sonnet-4-20250514",
    "claude-4-5-sonnet": "claude-sonnet-4-5-20250929",
    "claude-4-6-sonnet": "claude-sonnet-4-6",
    "claude-4-opus": "claude-opus-4-20250514",
    "claude-4-1-opus": "claude-opus-4-1-20250805",
    "claude-4-5-opus": "claude-opus-4-5-20251101",
    "claude-4-6-opus": "claude-opus-4-6",
    "claude-4-5-haiku": "claude-haiku-4-5-20251001",
    "gemini-3-flash": "gemini-3-flash-preview",
    "gemini-3.1-flash-lite": "gemini-3.1-flash-lite-preview",
    "gemini-3.1-pro": "gemini-3.1-pro-preview",
    "grok-4": "grok-4-0709",
    "command-r": "command-r-08-2024",
    "llama-4-scout": "meta/llama-4-scout-instruct",
    "llama-4-maverick": "meta/llama-4-maverick-instruct",
}


def resolve_model(model_id: str) -> str:
    if not model_id:
        return "gpt-4o-mini"
    return MODEL_ALIASES.get(model_id, model_id)
