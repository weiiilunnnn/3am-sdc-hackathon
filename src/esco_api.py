"""Bounded official ESCO lookups. Never called by normal matching requests."""
from collections import OrderedDict
from datetime import datetime, timezone
import hashlib
import json
import re
from time import monotonic, sleep
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, build_opener, HTTPRedirectHandler

BASE = "https://ec.europa.eu/esco/api/"
VERSIONS = {"v1.0.9", "v1.1.2", "v1.2.0", "v1.2.1"}
URI = re.compile(r"http://data\.europa\.eu/esco/(occupation|skill)/[0-9a-f-]{36}$")


class EscoError(ValueError):
    pass


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise EscoError("Upstream redirect refused")


class EscoClient:
    def __init__(self, opener=None, timeout=12, retries=1, ttl=86400, max_entries=128):
        self.opener = opener or build_opener(NoRedirect()).open
        self.timeout = min(max(timeout, 1), 30)
        self.retries = min(max(retries, 0), 2)
        self.ttl, self.max_entries = min(max(ttl, 0), 86400), min(max(max_entries, 1), 256)
        self.cache = OrderedDict()

    def fetch(self, kind, version, *, uri=None, text=None, limit=20, offset=0, collection=False):
        if kind not in {"occupation", "skill"} or version not in VERSIONS:
            raise EscoError("Unsupported concept kind or ESCO version")
        if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 100 or not isinstance(offset, int) or not 0 <= offset <= 20000:
            raise EscoError("Invalid upstream page bounds")
        params = {"language": "en", "selectedVersion": version}
        if uri:
            if not URI.fullmatch(uri) or f"/esco/{kind}/" not in uri:
                raise EscoError("Expected a canonical ESCO concept URI")
            params["uri"] = uri
            path = "resource/" + kind
        elif collection:
            params.update(isInScheme=f"http://data.europa.eu/esco/concept-scheme/{'occupations' if kind == 'occupation' else 'skills'}", viewObsolete="false", limit=limit, offset=offset)
            path = "resource/" + kind
        else:
            if not isinstance(text, str) or not 1 <= len(text.strip()) <= 100:
                raise EscoError("Search text must contain 1-100 characters")
            params.update(text=text.strip(), type=kind, limit=limit, offset=offset)
            path = "search"
        url = BASE + path + "?" + urlencode(params)
        if url in self.cache and monotonic() - self.cache[url][0] < self.ttl:
            self.cache.move_to_end(url)
            return {**self.cache[url][1], "cache_hit": True}
        for attempt in range(self.retries + 1):
            try:
                req = Request(url, headers={"Accept": "application/json", "User-Agent": "3AM-ESCO-reference-client/2.0"})
                with self.opener(req, timeout=self.timeout) as response:
                    raw = response.read(32 * 1024 * 1024 + 1)
                    header_version = response.headers.get("X-ESCO-Version")
                if len(raw) > 32 * 1024 * 1024:
                    raise EscoError("Upstream response exceeds 32 MiB")
                data = json.loads(raw)
                if not isinstance(data, dict):
                    raise EscoError("Invalid upstream object")
                returned = header_version or data.get("selectedVersion") or data.get("version")
                if returned and returned != version:
                    raise EscoError(f"Version mismatch: requested {version}, returned {returned}")
                if uri and (data.get("uri") != uri or data.get("className", "").casefold() != kind):
                    raise EscoError("Upstream identity mismatch")
                if not uri and not isinstance(data.get("_embedded"), dict):
                    raise EscoError("Malformed upstream collection")
                result = {"requested_version": version, "returned_version": returned, "language": "en",
                    "retrieved_at": datetime.now(timezone.utc).isoformat(), "source_url": url,
                    "source_uri": uri, "response_sha256": hashlib.sha256(raw).hexdigest(),
                    "cache_hit": False, "record": data,
                    "version_note": "Explicit selectedVersion; server does not expose a returned release" if returned is None else "Returned release checked"}
                self.cache[url] = monotonic(), result
                while len(self.cache) > self.max_entries:
                    self.cache.popitem(last=False)
                return result
            except (HTTPError, URLError, TimeoutError, OSError) as exc:
                if attempt == self.retries or isinstance(exc, HTTPError) and exc.code < 500 and exc.code != 429:
                    raise EscoError(f"Official ESCO service unavailable ({type(exc).__name__})") from exc
                sleep(.2 * (attempt + 1))
            except (json.JSONDecodeError, UnicodeError) as exc:
                raise EscoError("Malformed upstream JSON") from exc


client = EscoClient()
