"""
LLM provider supporting Groq, OpenRouter, and heuristic fallback.
"""

from __future__ import annotations

import os
import time
from datetime import datetime
from typing import Any, Dict, List

import httpx


class LLMProvider:
    def __init__(self) -> None:
        self.groq_key = os.environ.get("GROQ_API_KEY")
        self.openrouter_key = os.environ.get("OPENROUTER_API_KEY")
        self._cache: Dict[str, Dict[str, Any]] = {}

    async def _call_chat(self, messages: list[dict[str, str]]) -> tuple[str, str]:
        headers: Dict[str, str]
        url: str
        if self.groq_key:
            headers = {"Authorization": f"Bearer {self.groq_key}"}
            url = "https://api.groq.com/openai/v1/chat/completions"
        elif self.openrouter_key:
            headers = {"Authorization": f"Bearer {self.openrouter_key}"}
            url = "https://openrouter.ai/api/v1/chat/completions"
        else:
            raise RuntimeError("No LLM key configured")

        payload = {
            "model": "llama-3.1-8b-instant",
            "max_tokens": 600,
            "temperature": 0.3,
            "messages": messages,
        }
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            model_used = data.get("model", "llama-3.1-8b-instant")
            return content, model_used

    def summarize(self, text: str) -> str:
        return text[:220] + ("…" if len(text) > 220 else "")

    def ner(self, text: str) -> List[Dict[str, Any]]:
        ents = []
        for tok in text.split():
            if tok.istitle() and len(tok) > 3:
                ents.append({"text": tok, "type": "ENTITY"})
        return ents

    def classify_topics(self, text: str) -> List[str]:
        lower = text.lower()
        topics: List[str] = []
        if any(k in lower for k in ["military", "strike", "drill", "missile"]):
            topics.append("military")
        if any(k in lower for k in ["sanction", "tariff", "trade"]):
            topics.append("trade")
        if any(k in lower for k in ["inflation", "gdp", "economy"]):
            topics.append("economy")
        return topics or ["general"]

    async def synthesize_brief(self, events: list[dict[str, Any]]) -> Dict[str, Any]:
        cache_key = "world_brief"
        if cache_key in self._cache and self._cache[cache_key].get("expires", 0) > time.time():
            cached = self._cache[cache_key]
            return {**cached, "cached": True}

        top_events = sorted(events, key=lambda e: e.get("severity", "medium"), reverse=True)[:10]
        user_lines = [
            f"{e.get('severity','medium').upper()} | {e.get('country_code','GLOBAL')} | {e.get('event_type','Event')}: {e.get('headline','')}"
            for e in top_events
        ] or ["LOW | GLOBAL | INFO: No notable events"]

        system_prompt = (
            "You are a senior geopolitical intelligence analyst writing concise situational awareness briefs. "
            "Be factual, analytical, and actionable. Structure your response in exactly 3 paragraphs: (1) Most critical global developments in the past 24 hours, (2) Key market and economic implications, (3) Priority watchpoints for the next 48 hours. Write in plain prose without bullet points."
        )

        content: str
        model_used = "heuristic"
        try:
            content, model_used = await self._call_chat([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "\n".join(user_lines)},
            ])
            source = "llm"
        except Exception:
            critical = "; ".join(user_lines[:3])
            markets = "Energy prices remain sensitive; FX mixed; risk assets cautious."
            watch = "Monitor escalation triggers, supply disruptions, and policy surprises in next 48h."
            content = f"{critical}\n\n{markets}\n\n{watch}"
            source = "heuristic"

        sections = content.split("\n\n")
        brief_obj = {
            "brief": content.strip(),
            "sections": {
                "critical": sections[0] if len(sections) > 0 else "",
                "markets": sections[1] if len(sections) > 1 else "",
                "watchpoints": sections[2] if len(sections) > 2 else "",
            },
            "generated_at": datetime.now().isoformat(),
            "source": source,
            "cached": False,
            "model": model_used,
        }
        self._cache[cache_key] = {**brief_obj, "expires": time.time() + 1800}
        return brief_obj


async def get_llm_provider() -> LLMProvider:
    return LLMProvider()
