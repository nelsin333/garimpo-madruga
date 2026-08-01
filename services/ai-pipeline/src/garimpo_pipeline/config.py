from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str
    supabase_service_role_key: str
    database_url: str
    supabase_jwt_secret: str = ""

    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-5"
    claude_max_photos: int = 10
    claude_image_max_px: int = 768

    google_vision_api_key: str = ""

    # Encoder de imagem (CLIP ViT-B/32 visual, ONNX, 512 dims).
    embedding_model_url: str = (
        "https://huggingface.co/Qdrant/clip-ViT-B-32-vision/resolve/main/model.onnx"
    )
    embedding_model_path: str = "/tmp/garimpo-models/clip-vit-b-32-vision.onnx"
    embedding_model_name: str = "clip-vit-b-32-onnx"
    embedding_dim: int = 512

    worker_enabled: bool = True
    worker_poll_seconds: float = 2.0

    aggregator_version: str = "aggregator-v1"

    check_photos_bucket: str = "check-photos"
    reference_photos_bucket: str = "reference-photos"
    signed_url_ttl_seconds: int = 3600


@lru_cache
def settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
