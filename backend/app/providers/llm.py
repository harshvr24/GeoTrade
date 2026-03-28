import os
from typing import Dict, Any, List


class LLMProvider:
    """Pluggable LLM provider. Defaults to heuristic for offline safety."""

    def __init__(self):
        self.mode = os.environ.get("LLM_PROVIDER", "heuristic")

    def summarize(self, text: str) -> str:
        if self.mode == "heuristic" or not text:
            return text[:220] + ("…" if len(text) > 220 else "")
        # Future: integrate OpenAI/Ollama
        return text

    def ner(self, text: str) -> List[Dict[str, Any]]:
        # Placeholder simple NER on capitalized tokens
        ents = []
        for tok in text.split():
            if tok.istitle() and len(tok) > 3:
                ents.append({"text": tok, "type": "ENTITY"})
        return ents

    def classify_topics(self, text: str) -> List[str]:
        lower = text.lower()
        topics = []
        if any(k in lower for k in ["military", "strike", "drill", "missile"]):
            topics.append("military")
        if any(k in lower for k in ["sanction", "tariff", "trade"]):
            topics.append("trade")
        if any(k in lower for k in ["inflation", "gdp", "economy"]):
            topics.append("economy")
        return topics or ["general"]
