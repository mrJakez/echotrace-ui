"""OAuth-protected EchoTrace MCP server backed by the existing Next.js API."""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import jwt
from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.auth.provider import AccessToken, TokenVerifier
from mcp.server.auth.settings import AuthSettings
from mcp.server.fastmcp import FastMCP
from mcp.types import ToolAnnotations
from pydantic import AnyHttpUrl


PUBLIC_APP_URL = os.getenv("AUTH_ORIGIN", "http://localhost:3000").rstrip("/")
API_BASE_URL = os.getenv("ECHOTRACE_API_URL", "http://127.0.0.1:3000").rstrip("/")
OAUTH_ISSUER_URL = os.getenv("OAUTH_ISSUER_URL", f"{PUBLIC_APP_URL}/oauth").rstrip("/")
OAUTH_ISSUER_INTERNAL_URL = os.getenv("OAUTH_ISSUER_INTERNAL_URL", "http://127.0.0.1:8090/oauth").rstrip("/")
MCP_RESOURCE_URL = os.getenv("MCP_RESOURCE_URL", f"{PUBLIC_APP_URL}/mcp").rstrip("/")
MCP_AUDIENCE = os.getenv("MCP_AUDIENCE", "echotrace-mcp").strip() or "echotrace-mcp"
MCP_AUTH_ENABLED = os.getenv("MCP_AUTH_ENABLED", "true").strip().casefold() not in {"0", "false", "no"}
INTERNAL_API_TOKEN = (os.getenv("MCP_INTERNAL_API_TOKEN") or os.getenv("API_TOKEN") or "").strip()
AUTH_SESSION_SECRET = os.getenv("AUTH_SESSION_SECRET", "").strip()
AUTH_SESSION_COOKIE = os.getenv("AUTH_SESSION_COOKIE", "echotrace_session").strip() or "echotrace_session"
DATA_DIR = Path(os.getenv("MCP_DATA_DIR", "/data"))
JWT_KEY_ID = "echotrace-local-1"
SCOPES = {
    "openid",
    "offline_access",
    "recordings:read",
    "recordings:write",
    "prompts:read",
    "tags:read",
}

if MCP_AUTH_ENABLED and not AUTH_SESSION_SECRET:
    raise RuntimeError("AUTH_SESSION_SECRET is required when MCP authentication is enabled")
if not INTERNAL_API_TOKEN:
    raise RuntimeError("MCP_INTERNAL_API_TOKEN or API_TOKEN is required for EchoTrace API delegation")


def _now() -> int:
    return int(time.time())


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def _connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATA_DIR / "oauth.sqlite3")
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.executescript(
        """
        CREATE TABLE IF NOT EXISTS oauth_clients (
          client_id TEXT PRIMARY KEY,
          metadata_json TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS oauth_codes (
          code_hash TEXT PRIMARY KEY,
          client_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          email TEXT NOT NULL,
          redirect_uri TEXT NOT NULL,
          scope TEXT NOT NULL,
          resource TEXT NOT NULL,
          code_challenge TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          used INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
          token_hash TEXT PRIMARY KEY,
          client_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          email TEXT NOT NULL,
          scope TEXT NOT NULL,
          resource TEXT NOT NULL,
          expires_at INTEGER NOT NULL
        );
        """
    )
    connection.commit()
    return connection


def _private_key():
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import rsa

    path = DATA_DIR / "oauth-private.pem"
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        path.write_bytes(
            key.private_bytes(
                serialization.Encoding.PEM,
                serialization.PrivateFormat.PKCS8,
                serialization.NoEncryption(),
            )
        )
        path.chmod(0o600)
    return serialization.load_pem_private_key(path.read_bytes(), password=None)


def _b64_int(value: int) -> str:
    raw = value.to_bytes((value.bit_length() + 7) // 8, "big")
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def oauth_public_jwk() -> dict[str, Any]:
    numbers = _private_key().public_key().public_numbers()
    return {
        "kty": "RSA",
        "use": "sig",
        "alg": "RS256",
        "kid": JWT_KEY_ID,
        "n": _b64_int(numbers.n),
        "e": _b64_int(numbers.e),
    }


def issue_access_token(user_id: str, email: str, client_id: str, scope: str, resource: str) -> str:
    now = _now()
    return jwt.encode(
        {
            "iss": OAUTH_ISSUER_URL,
            "sub": user_id,
            "aud": MCP_AUDIENCE,
            "azp": client_id,
            "email": email,
            "scope": scope,
            "resource": resource,
            "iat": now,
            "exp": now + 3600,
        },
        _private_key(),
        algorithm="RS256",
        headers={"kid": JWT_KEY_ID},
    )


def _decode_access_token(token: str) -> dict[str, Any]:
    public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(oauth_public_jwk()))
    return jwt.decode(
        token,
        public_key,
        algorithms=["RS256"],
        audience=MCP_AUDIENCE,
        issuer=OAUTH_ISSUER_URL,
        options={"require": ["exp", "iat", "iss", "sub"]},
    )


def _decode_session_cookie(token: str | None) -> dict[str, str] | None:
    if not token or not AUTH_SESSION_SECRET:
        return None
    try:
        encoded, signature = token.split(".", 1)
        expected = base64.urlsafe_b64encode(
            hmac.new(AUTH_SESSION_SECRET.encode(), encoded.encode(), hashlib.sha256).digest()
        ).rstrip(b"=").decode()
        if not hmac.compare_digest(signature, expected):
            return None
        payload = json.loads(base64.urlsafe_b64decode(encoded + "=" * (-len(encoded) % 4)).decode())
        if int(payload.get("exp", 0)) < int(time.time() * 1000):
            return None
        user_id = str(payload.get("userId") or "").strip()
        email = str(payload.get("email") or "").strip()
        return {"userId": user_id, "email": email} if user_id and email else None
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


def oauth_metadata() -> dict[str, Any]:
    base = OAUTH_ISSUER_URL
    return {
        "issuer": base,
        "authorization_endpoint": base + "/authorize",
        "token_endpoint": base + "/token",
        "registration_endpoint": base + "/register",
        "jwks_uri": base + "/jwks",
        "userinfo_endpoint": base + "/userinfo",
        "authorization_response_iss_parameter_supported": True,
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none"],
        "scopes_supported": sorted(SCOPES),
        "client_id_metadata_document_supported": True,
    }


def register_oauth_client(metadata: dict[str, Any]) -> dict[str, Any]:
    redirect_uris = metadata.get("redirect_uris") or []
    if not isinstance(redirect_uris, list) or not redirect_uris:
        raise HTTPException(400, "redirect_uris is required")
    if any(not isinstance(uri, str) or not uri.startswith(("https://", "http://localhost")) for uri in redirect_uris):
        raise HTTPException(400, "Invalid redirect_uri")

    requested_client_id = str(metadata.get("client_id") or "").strip()
    if requested_client_id:
        parsed = urllib.parse.urlparse(requested_client_id)
        if parsed.scheme != "https" or parsed.hostname not in {"chatgpt.com", "platform.openai.com"}:
            raise HTTPException(400, "Client metadata URL is not allowed")
        client_id = requested_client_id
    else:
        client_id = "echotrace-" + secrets.token_urlsafe(18)

    stored = {**metadata, "client_id": client_id, "redirect_uris": redirect_uris}
    with _connect() as db:
        db.execute(
            "INSERT OR REPLACE INTO oauth_clients VALUES(?,?,?)",
            (client_id, json.dumps(stored), _now()),
        )
    return {
        "client_id": client_id,
        "client_id_issued_at": _now(),
        "token_endpoint_auth_method": "none",
        "redirect_uris": redirect_uris,
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "scope": " ".join(sorted(SCOPES)),
    }


class LocalTokenVerifier(TokenVerifier):
    """Validate access tokens issued by EchoTrace's local OAuth provider."""

    def __init__(self) -> None:
        self._jwks: dict[str, Any] | None = None
        self._loaded_at = 0.0

    def _load_keys(self) -> dict[str, Any]:
        if self._jwks and time.time() - self._loaded_at < 300:
            return self._jwks
        with urllib.request.urlopen(f"{OAUTH_ISSUER_INTERNAL_URL}/jwks", timeout=10) as response:
            self._jwks = json.loads(response.read().decode())
        self._loaded_at = time.time()
        return self._jwks or {}

    def _verify_sync(self, token: str) -> AccessToken | None:
        try:
            header = jwt.get_unverified_header(token)
            key_data = next(key for key in self._load_keys().get("keys", []) if key.get("kid") == header.get("kid"))
            public_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key_data))
            claims = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                audience=MCP_AUDIENCE,
                issuer=OAUTH_ISSUER_URL,
                options={"require": ["exp", "iat", "iss", "sub"]},
            )
            if claims.get("resource") != MCP_RESOURCE_URL:
                return None
            return AccessToken(
                token=token,
                client_id=str(claims.get("azp") or "echotrace-oauth"),
                scopes=str(claims.get("scope") or "").split(),
                expires_at=int(claims["exp"]),
                resource=MCP_RESOURCE_URL,
                subject=str(claims["sub"]),
                claims=claims,
            )
        except (jwt.PyJWTError, KeyError, StopIteration, OSError, ValueError, json.JSONDecodeError):
            return None

    async def verify_token(self, token: str) -> AccessToken | None:
        return await asyncio.to_thread(self._verify_sync, token)


mcp_kwargs: dict[str, Any] = {
    "name": "EchoTrace",
    "instructions": (
        "EchoTrace stellt Aufnahmen, Transkripte, Sprecher-Sätze, Tags und Prompts bereit. "
        "Nutze list_recordings oder search_recordings, bevor du get_recording aufrufst. "
        "Änderungen am Review-Status, Titel oder an Notizen sind schreibende Aktionen und "
        "müssen dem Nutzer vor der Ausführung klar genannt werden."
    ),
    "host": "0.0.0.0",
    "port": int(os.getenv("MCP_PORT", "8090")),
    "stateless_http": True,
    "json_response": True,
}
if MCP_AUTH_ENABLED:
    mcp_kwargs["token_verifier"] = LocalTokenVerifier()
    mcp_kwargs["auth"] = AuthSettings(
        issuer_url=AnyHttpUrl(OAUTH_ISSUER_URL),
        resource_server_url=AnyHttpUrl(MCP_RESOURCE_URL),
        required_scopes=["recordings:read", "recordings:write", "prompts:read", "tags:read"],
    )

mcp = FastMCP(**mcp_kwargs)


def _access_token() -> AccessToken | None:
    if not MCP_AUTH_ENABLED:
        return None
    access_token = get_access_token()
    if not access_token:
        raise PermissionError("Authenticated OAuth user required")
    return access_token


def _require_scope(scope: str) -> None:
    access_token = _access_token()
    if access_token and scope not in access_token.scopes:
        raise PermissionError(f"OAuth scope required: {scope}")


def _api_sync(path: str, method: str = "GET", body: dict[str, Any] | None = None) -> Any:
    access_token = _access_token()
    claims = access_token.claims if access_token else {}
    headers = {
        "Accept": "application/json",
        "X-EchoTrace-Internal-Token": INTERNAL_API_TOKEN,
        "X-EchoTrace-User-ID": str(access_token.subject) if access_token and access_token.subject else "local-mcp",
        "X-EchoTrace-User-Email": str(claims.get("email") or "mcp@echotrace.local"),
    }
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode()
    request = urllib.request.Request(f"{API_BASE_URL}{path}", headers=headers, data=data, method=method)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"EchoTrace API returned HTTP {exc.code}: {detail[:500]}") from exc
    except (urllib.error.URLError, TimeoutError) as exc:
        raise RuntimeError(f"EchoTrace API at {API_BASE_URL} is unavailable: {exc}") from exc


async def _api(path: str, method: str = "GET", body: dict[str, Any] | None = None) -> Any:
    return await asyncio.to_thread(_api_sync, path, method, body)


READ_ONLY = ToolAnnotations(readOnlyHint=True, destructiveHint=False, openWorldHint=False)
WRITE = ToolAnnotations(readOnlyHint=False, destructiveHint=False, idempotentHint=True, openWorldHint=False)


@mcp.tool(annotations=READ_ONLY, meta={"securitySchemes": [{"type": "oauth2", "scopes": []}]})
async def whoami() -> dict[str, Any]:
    """Return the EchoTrace user and OAuth identity used by this connection."""
    access_token = _access_token()
    identity = await _api("/api/auth/me")
    identity["oauth"] = {
        "subject": str(access_token.subject) if access_token and access_token.subject else None,
        "clientId": access_token.client_id if access_token else None,
        "scopes": sorted(access_token.scopes) if access_token else [],
        "resource": access_token.resource if access_token else None,
        "expiresAt": access_token.expires_at if access_token else None,
    }
    return identity


def _recording_query(
    *,
    query: str | None = None,
    review_status: str | None = None,
    categories: list[str] | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> str:
    if review_status and review_status not in {"pending_review", "approved", "rejected"}:
        raise ValueError("review_status must be pending_review, approved, or rejected")
    if categories and any(value not in {"work", "private", "unknown"} for value in categories):
        raise ValueError("categories may only contain work, private, or unknown")
    params: dict[str, str] = {
        "scope": "all",
        "limit": str(max(1, min(limit, 100))),
        "offset": str(max(0, offset)),
    }
    if query:
        params["q"] = query
    if review_status:
        params["reviewStatuses"] = review_status
    if categories:
        params["categories"] = ",".join(categories)
    if date_from:
        params["dateFrom"] = date_from
    if date_to:
        params["dateTo"] = date_to
    return "/api/recordings?" + urllib.parse.urlencode(params)


@mcp.tool(annotations=READ_ONLY, meta={"securitySchemes": [{"type": "oauth2", "scopes": ["recordings:read"]}]})
async def list_recordings(
    review_status: str | None = None,
    categories: list[str] | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    """List newest recordings, optionally filtered by review state, category, or ISO date range."""
    _require_scope("recordings:read")
    return await _api(
        _recording_query(
            review_status=review_status,
            categories=categories,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            offset=offset,
        )
    )


@mcp.tool(annotations=READ_ONLY, meta={"securitySchemes": [{"type": "oauth2", "scopes": ["recordings:read"]}]})
async def search_recordings(query: str, limit: int = 20, offset: int = 0) -> dict[str, Any]:
    """Search recording titles, summaries, transcript sentences, identifiers, and tags."""
    _require_scope("recordings:read")
    if not query.strip():
        raise ValueError("query is required")
    return await _api(_recording_query(query=query.strip(), limit=limit, offset=offset))


@mcp.tool(annotations=READ_ONLY, meta={"securitySchemes": [{"type": "oauth2", "scopes": ["recordings:read"]}]})
async def get_recording(recording_id: str) -> dict[str, Any]:
    """Get one recording with transcript, sentence timeline, speakers, tags, notes, and logs."""
    _require_scope("recordings:read")
    return await _api(f"/api/recordings/{urllib.parse.quote(recording_id, safe='')}")


@mcp.tool(annotations=READ_ONLY, meta={"securitySchemes": [{"type": "oauth2", "scopes": ["prompts:read"]}]})
async def list_prompts() -> list[dict[str, Any]]:
    """List the prompts configured in EchoTrace, including their Markdown content."""
    _require_scope("prompts:read")
    return await _api("/api/prompts")


@mcp.tool(annotations=READ_ONLY, meta={"securitySchemes": [{"type": "oauth2", "scopes": ["prompts:read"]}]})
async def get_prompt(prompt_id: str) -> dict[str, Any]:
    """Get one EchoTrace prompt by its stable ID."""
    _require_scope("prompts:read")
    return await _api(f"/api/prompts/{urllib.parse.quote(prompt_id, safe='')}")


@mcp.tool(annotations=READ_ONLY, meta={"securitySchemes": [{"type": "oauth2", "scopes": ["tags:read"]}]})
async def list_tags() -> list[dict[str, Any]]:
    """List the hierarchical EchoTrace tag library with assignment counts."""
    _require_scope("tags:read")
    return await _api("/api/tags")


@mcp.tool(annotations=WRITE, meta={"securitySchemes": [{"type": "oauth2", "scopes": ["recordings:write"]}]})
async def update_recording_review_status(recording_id: str, review_status: str) -> dict[str, Any]:
    """Change a recording review status to pending_review, approved, or rejected."""
    _require_scope("recordings:write")
    if review_status not in {"pending_review", "approved", "rejected"}:
        raise ValueError("Invalid review_status")
    return await _api(
        f"/api/recordings/{urllib.parse.quote(recording_id, safe='')}",
        method="PATCH",
        body={"reviewStatus": review_status},
    )


@mcp.tool(annotations=WRITE, meta={"securitySchemes": [{"type": "oauth2", "scopes": ["recordings:write"]}]})
async def update_recording_title(recording_id: str, title: str | None) -> dict[str, Any]:
    """Set or clear the custom title of a recording."""
    _require_scope("recordings:write")
    if title is not None and len(title) > 255:
        raise ValueError("title may contain at most 255 characters")
    return await _api(
        f"/api/recordings/{urllib.parse.quote(recording_id, safe='')}",
        method="PATCH",
        body={"title": title},
    )


@mcp.tool(annotations=WRITE, meta={"securitySchemes": [{"type": "oauth2", "scopes": ["recordings:write"]}]})
async def update_recording_notes(recording_id: str, notes: str | None) -> dict[str, Any]:
    """Set or clear the notes attached to a recording."""
    _require_scope("recordings:write")
    if notes is not None and len(notes) > 20000:
        raise ValueError("notes may contain at most 20000 characters")
    return await _api(
        f"/api/recordings/{urllib.parse.quote(recording_id, safe='')}",
        method="PATCH",
        body={"notes": notes},
    )


@asynccontextmanager
async def lifespan(_: FastAPI):
    async with mcp.session_manager.run():
        yield


app = FastAPI(title="EchoTrace MCP", version="1.0.0", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/oauth/.well-known/openid-configuration")
@app.get("/.well-known/oauth-authorization-server")
@app.get("/.well-known/oauth-authorization-server/oauth")
def oauth_discovery() -> dict[str, Any]:
    return oauth_metadata()


def protected_resource_metadata() -> dict[str, Any]:
    return {
        "resource": MCP_RESOURCE_URL,
        "authorization_servers": [OAUTH_ISSUER_URL],
        "scopes_supported": sorted(SCOPES),
        "bearer_methods_supported": ["header"],
        "resource_documentation": "https://github.com/jakez/echotrace-ui#chatgpt-mcp-connection",
    }


@app.get("/.well-known/oauth-protected-resource")
@app.get("/.well-known/oauth-protected-resource/mcp")
def oauth_protected_resource() -> dict[str, Any]:
    return protected_resource_metadata()


@app.get("/oauth/jwks")
def oauth_jwks() -> dict[str, Any]:
    return {"keys": [oauth_public_jwk()]}


@app.post("/oauth/register")
def oauth_register(payload: dict[str, Any]) -> dict[str, Any]:
    return register_oauth_client(payload)


def _load_client(client_id: str) -> dict[str, Any] | None:
    with _connect() as db:
        row = db.execute("SELECT metadata_json FROM oauth_clients WHERE client_id=?", (client_id,)).fetchone()
    if row:
        return json.loads(row["metadata_json"])
    if not client_id.startswith(("https://chatgpt.com/", "https://platform.openai.com/")):
        return None
    try:
        with urllib.request.urlopen(client_id, timeout=10) as response:
            metadata = json.loads(response.read().decode())
        register_oauth_client({**metadata, "client_id": client_id})
        return {**metadata, "client_id": client_id}
    except Exception as exc:
        raise HTTPException(400, f"Could not load OAuth client metadata: {exc}") from exc


@app.get("/oauth/authorize")
def oauth_authorize(
    request: Request,
    client_id: str,
    redirect_uri: str,
    response_type: str = "code",
    scope: str = "openid",
    state: str = "",
    code_challenge: str = "",
    code_challenge_method: str = "S256",
    resource: str = MCP_RESOURCE_URL,
) -> RedirectResponse:
    if response_type != "code" or code_challenge_method != "S256" or not code_challenge:
        raise HTTPException(400, "Authorization Code with PKCE S256 is required")
    requested = set(scope.split())
    if not requested or not requested.issubset(SCOPES):
        raise HTTPException(400, "OAuth scope is not allowed")
    if resource.rstrip("/") != MCP_RESOURCE_URL:
        raise HTTPException(400, "Invalid OAuth resource")

    metadata = _load_client(client_id)
    if not metadata:
        raise HTTPException(400, "OAuth client is not registered")
    allowed_redirects = metadata.get("redirect_uris") or []
    if redirect_uri not in allowed_redirects:
        raise HTTPException(400, "Invalid redirect_uri")

    session = _decode_session_cookie(request.cookies.get(AUTH_SESSION_COOKIE))
    if not session:
        current = request.url.path + ("?" + request.url.query if request.url.query else "")
        return RedirectResponse("/login?next=" + urllib.parse.quote(current, safe=""), status_code=303)

    code = secrets.token_urlsafe(48)
    with _connect() as db:
        db.execute(
            "INSERT INTO oauth_codes VALUES(?,?,?,?,?,?,?,?,?,0)",
            (
                _hash(code),
                client_id,
                session["userId"],
                session["email"],
                redirect_uri,
                " ".join(sorted(requested)),
                MCP_RESOURCE_URL,
                code_challenge,
                _now() + 300,
            ),
        )
    query = urllib.parse.urlencode({"code": code, "state": state, "iss": OAUTH_ISSUER_URL})
    return RedirectResponse(f"{redirect_uri}?{query}", status_code=303)


@app.post("/oauth/token")
def oauth_token(
    grant_type: str = Form(...),
    code: str | None = Form(None),
    redirect_uri: str | None = Form(None),
    client_id: str | None = Form(None),
    code_verifier: str | None = Form(None),
    refresh_token: str | None = Form(None),
    resource: str | None = Form(None),
) -> dict[str, Any]:
    refresh_hash_to_delete: str | None = None
    if grant_type == "authorization_code":
        if not code or not redirect_uri or not client_id or not code_verifier:
            raise HTTPException(400, "code, redirect_uri, client_id, and code_verifier are required")
        with _connect() as db:
            row = db.execute("SELECT * FROM oauth_codes WHERE code_hash=?", (_hash(code),)).fetchone()
            if (
                not row
                or row["used"]
                or row["expires_at"] <= _now()
                or row["redirect_uri"] != redirect_uri
                or row["client_id"] != client_id
            ):
                raise HTTPException(400, "Invalid or expired authorization code")
            expected = base64.urlsafe_b64encode(hashlib.sha256(code_verifier.encode()).digest()).rstrip(b"=").decode()
            if not secrets.compare_digest(expected, row["code_challenge"]):
                raise HTTPException(400, "PKCE verification failed")
            if resource and resource.rstrip("/") != row["resource"]:
                raise HTTPException(400, "OAuth resource does not match authorization request")
            db.execute("UPDATE oauth_codes SET used=1 WHERE code_hash=?", (_hash(code),))
            user_id, email, client_id, granted, resource = (
                row["user_id"],
                row["email"],
                row["client_id"],
                row["scope"],
                row["resource"],
            )
    elif grant_type == "refresh_token" and refresh_token and client_id:
        refresh_hash_to_delete = _hash(refresh_token)
        with _connect() as db:
            row = db.execute(
                "SELECT * FROM oauth_refresh_tokens WHERE token_hash=?",
                (refresh_hash_to_delete,),
            ).fetchone()
        if not row or row["expires_at"] <= _now() or row["client_id"] != client_id:
            raise HTTPException(400, "Invalid refresh token")
        if resource and resource.rstrip("/") != row["resource"]:
            raise HTTPException(400, "Invalid OAuth resource")
        user_id, email, client_id, granted, resource = (
            row["user_id"],
            row["email"],
            row["client_id"],
            row["scope"],
            row["resource"],
        )
    else:
        raise HTTPException(400, "Unsupported grant_type")

    access = issue_access_token(str(user_id), str(email), str(client_id), str(granted), str(resource))
    new_refresh = secrets.token_urlsafe(48)
    with _connect() as db:
        if refresh_hash_to_delete:
            db.execute("DELETE FROM oauth_refresh_tokens WHERE token_hash=?", (refresh_hash_to_delete,))
        db.execute(
            "INSERT INTO oauth_refresh_tokens VALUES(?,?,?,?,?,?,?)",
            (_hash(new_refresh), str(client_id), str(user_id), str(email), str(granted), str(resource), _now() + 30 * 86400),
        )
    return {
        "access_token": access,
        "token_type": "Bearer",
        "expires_in": 3600,
        "refresh_token": new_refresh,
        "scope": granted,
    }


@app.get("/oauth/userinfo")
def oauth_userinfo(request: Request) -> dict[str, Any]:
    authorization = request.headers.get("authorization", "")
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(401, "Bearer token required")
    try:
        claims = _decode_access_token(authorization[7:].strip())
    except jwt.PyJWTError as exc:
        raise HTTPException(401, "Invalid bearer token") from exc
    return {"sub": claims["sub"], "email": claims.get("email")}


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code, headers=exc.headers)


# FastMCP owns /mcp and is mounted last so OAuth and metadata routes keep precedence.
app.mount("/", mcp.streamable_http_app())
