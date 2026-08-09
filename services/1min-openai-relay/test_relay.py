#!/usr/bin/env python3
"""Smoke tests for the 1min OpenAI relay (no live API key required)."""

import importlib
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))

os.environ.setdefault("ALLOW_ALL_MODELS", "true")

import app as relay  # noqa: E402
from models import CHAT_MODELS, resolve_model  # noqa: E402


class ModelCatalogTests(unittest.TestCase):
    def test_catalog_has_modern_models(self):
        for model_id in (
            "gpt-5.4",
            "claude-sonnet-4-6",
            "claude-opus-4-6",
            "gemini-2.5-pro",
            "deepseek-chat",
            "grok-4-0709",
            "qwen3-coder-plus",
        ):
            self.assertIn(model_id, CHAT_MODELS)

    def test_aliases_resolve(self):
        self.assertEqual(resolve_model("claude-4-6-sonnet"), "claude-sonnet-4-6")
        self.assertEqual(resolve_model("grok-4"), "grok-4-0709")


class RelayEndpointTests(unittest.TestCase):
    def setUp(self):
        relay.app.config["TESTING"] = True
        self.client = relay.app.test_client()

    def test_health(self):
        resp = self.client.get("/health")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.get_json()["ok"])
        self.assertTrue(resp.get_json()["allow_all_models"])

    def test_models_list(self):
        resp = self.client.get("/v1/models")
        self.assertEqual(resp.status_code, 200)
        ids = {item["id"] for item in resp.get_json()["data"]}
        self.assertIn("claude-sonnet-4-6", ids)
        self.assertIn("gpt-5.4", ids)
        self.assertGreaterEqual(len(ids), 70)

    def test_chat_requires_api_key(self):
        resp = self.client.post(
            "/v1/chat/completions",
            json={"model": "gpt-4o-mini", "messages": [{"role": "user", "content": "hi"}]},
        )
        self.assertEqual(resp.status_code, 401)
        self.assertEqual(resp.get_json()["error"]["code"], "invalid_api_key")

    def test_allow_all_models_does_not_reject_unknown_locally(self):
        # Without a valid key we still prove the relay does not 400 on unknown model IDs.
        resp = self.client.post(
            "/v1/chat/completions",
            headers={"Authorization": "Bearer fake"},
            json={
                "model": "totally-new-1min-model",
                "messages": [{"role": "user", "content": "hi"}],
            },
        )
        # Upstream auth fails (401) rather than local model_not_found (400).
        self.assertEqual(resp.status_code, 401)
        self.assertNotEqual(resp.get_json()["error"].get("code"), "model_not_found")


class RestrictedModeTests(unittest.TestCase):
    def test_restricted_mode_rejects_unknown_model(self):
        os.environ["ALLOW_ALL_MODELS"] = "false"
        importlib.reload(relay)
        client = relay.app.test_client()
        resp = client.post(
            "/v1/chat/completions",
            headers={"Authorization": "Bearer fake"},
            json={
                "model": "totally-new-1min-model",
                "messages": [{"role": "user", "content": "hi"}],
            },
        )
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(resp.get_json()["error"]["code"], "model_not_found")
        os.environ["ALLOW_ALL_MODELS"] = "true"
        importlib.reload(relay)


if __name__ == "__main__":
    unittest.main()
