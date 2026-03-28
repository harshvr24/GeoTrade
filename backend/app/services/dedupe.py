import hashlib
from urllib.parse import urlparse


def normalize_url(url: str) -> str:
    if not url:
        return ""
    parsed = urlparse(url)
    netloc = parsed.netloc.lower().replace("www.", "")
    path = parsed.path.rstrip("/")
    return f"{parsed.scheme}://{netloc}{path}"


def content_hash(text: str) -> str:
    return hashlib.sha256((text or "").encode("utf-8")).hexdigest()


def is_duplicate(seen_hashes: set[str], text: str, url: str | None = None) -> bool:
    h = content_hash((normalize_url(url) if url else "") + text)
    if h in seen_hashes:
        return True
    seen_hashes.add(h)
    return False
