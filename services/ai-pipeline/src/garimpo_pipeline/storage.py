"""Supabase Storage via REST (service role): download e URLs assinadas."""

import httpx

from .config import settings

_client: httpx.Client | None = None


def client() -> httpx.Client:
    global _client
    if _client is None:
        s = settings()
        _client = httpx.Client(
            base_url=f"{s.supabase_url}/storage/v1",
            headers={
                "Authorization": f"Bearer {s.supabase_service_role_key}",
                "apikey": s.supabase_service_role_key,
            },
            timeout=httpx.Timeout(30.0),
        )
    return _client


def download(bucket: str, path: str) -> bytes:
    response = client().get(f"/object/{bucket}/{path}")
    response.raise_for_status()
    return response.content


def signed_url(bucket: str, path: str, ttl: int | None = None) -> str:
    s = settings()
    response = client().post(
        f"/object/sign/{bucket}/{path}",
        json={"expiresIn": ttl or s.signed_url_ttl_seconds},
    )
    response.raise_for_status()
    signed_path = response.json()["signedURL"]
    return f"{s.supabase_url}/storage/v1{signed_path}"
