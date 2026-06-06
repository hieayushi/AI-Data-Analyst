from pydantic_settings import BaseSettings
from pydantic import model_validator
from pathlib import Path
from typing import Optional


class Settings(BaseSettings):
    # ── Azure OpenAI — GPT-4.1 (chat / SQL generation) ──────────────────────
    azure_openai_endpoint: str
    azure_openai_api_key: str
    azure_openai_api_version: str = "2024-02-01"
    azure_gpt_deployment: str = "gpt-4.1"

    # ── Azure OpenAI — text-embedding-ada-002 ────────────────────────────────
    # If the embedding model is on the SAME Azure resource as GPT, leave these
    # blank — they will automatically fall back to the GPT endpoint/key above.
    # If it is on a DIFFERENT resource, fill in the separate values.
    azure_embedding_endpoint: Optional[str] = None
    azure_embedding_api_key: Optional[str] = None
    azure_embedding_api_version: str = "2023-05-15"
    azure_embedding_deployment: str = "text-embedding-ada-002"

    # Resolved at startup (see validator below)
    effective_embedding_endpoint: str = ""
    effective_embedding_api_key: str = ""

    @model_validator(mode="after")
    def resolve_embedding_credentials(self):
        self.effective_embedding_endpoint = (
            self.azure_embedding_endpoint or self.azure_openai_endpoint
        )
        self.effective_embedding_api_key = (
            self.azure_embedding_api_key or self.azure_openai_api_key
        )
        return self

    # ── Qdrant (local persistent, no Docker) ─────────────────────────────────
    qdrant_path: str = "./qdrant_storage"
    qdrant_collection: str = "schema_embeddings"

    # ── App ───────────────────────────────────────────────────────────────────
    data_dir: str = "./data"
    schema_json_path: str = "./data/schema.json"
    max_tokens: int = 4096

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()

# Ensure directories exist
Path(settings.data_dir).mkdir(parents=True, exist_ok=True)
Path(settings.qdrant_path).mkdir(parents=True, exist_ok=True)
