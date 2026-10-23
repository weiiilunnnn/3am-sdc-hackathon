"""Bounded Tavily Search/Extract transport. Never fetch arbitrary URLs locally."""
import ipaddress
import json
import os
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from urllib.request import Request, build_opener, HTTPRedirectHandler


class TavilyError(RuntimeError):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def canonical_url(value: str) -> str:
    p = urlsplit(value)
    host = (p.hostname or "").lower()
    if (p.scheme != "https" or not host or p.username or p.password or p.port not in (None, 443)
            or any(c.isspace() or ord(c) < 32 for c in value) or "\\" in value
            or host.endswith((".localhost", ".local", ".internal")) or host == "localhost"):
        raise ValueError("Unsafe provider URL")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        address = None
    if address is not None and not address.is_global:
        raise ValueError("Non-public provider URL")
    query = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True)
             if not k.lower().startswith("utm_") and k.lower() not in {"gclid", "fbclid"}]
    return urlunsplit(("https", host, p.path or "/", urlencode(sorted(query)), ""))


def _post(kind: str, payload: dict, timeout: float) -> dict:
    key = os.getenv("TAVILY_API_KEY")
    if not key:
        raise TavilyError("unconfigured")
    request = Request(f"https://api.tavily.com/{kind}", data=json.dumps(payload).encode(),
                      headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    try:
        with build_opener(NoRedirect()).open(request, timeout=timeout) as response:
            raw = response.read(1_000_001)
        if len(raw) > 1_000_000:
            raise ValueError("oversize")
        result = json.loads(raw)
        if not isinstance(result, dict):
            raise ValueError("invalid")
        return result
    except Exception as exc:
        # Do not propagate provider bodies, headers, credentials or queries.
        raise TavilyError("search_or_extract_unavailable") from exc


def search(query: str, *, timeout: float, include_domains: tuple[str, ...] | None = None) -> dict:
    payload = {"query": query, "search_depth": "basic", "topic": "general", "max_results": 4,
               "include_answer": False, "include_raw_content": False, "include_usage": True}
    if include_domains:
        payload["include_domains"] = list(include_domains)
    return _post("search", payload, timeout)


def extract(urls: list[str], *, timeout: float) -> dict:
    return _post("extract", {"urls": urls, "extract_depth": "basic", "format": "markdown",
                            "include_usage": True, "timeout": min(timeout, 5)}, timeout)
