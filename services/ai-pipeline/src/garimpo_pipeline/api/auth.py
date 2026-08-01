"""Verificação de JWT do Supabase Auth.

Suporta os dois esquemas: HS256 com SUPABASE_JWT_SECRET (projetos legados)
e chaves assimétricas via JWKS do próprio projeto (padrão atual).
"""

from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, Request

from ..config import settings


@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(
        f"{settings().supabase_url}/auth/v1/.well-known/jwks.json",
        cache_keys=True,
        lifespan=3600,
    )


def _decode(token: str) -> dict:
    s = settings()
    options = {"verify_aud": True}
    if s.supabase_jwt_secret:
        return jwt.decode(
            token,
            s.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
            options=options,
        )
    signing_key = _jwks_client().get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["ES256", "RS256"],
        audience="authenticated",
        options=options,
    )


def current_user_id(request: Request) -> str:
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="missing_bearer_token")
    token = header[7:].strip()
    try:
        claims = _decode(token)
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail=f"invalid_token: {exc}") from exc
    subject = claims.get("sub")
    if not subject:
        raise HTTPException(status_code=401, detail="token_without_subject")
    return str(subject)


UserId = Depends(current_user_id)
