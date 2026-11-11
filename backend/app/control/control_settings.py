from pathlib import Path

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", hide_input_in_errors=True)

    cors_origins: list[str] = ["http://127.0.0.1:3000", "http://localhost:3000"]
    database_url: SecretStr | None = Field(default=None, repr=False)
    database_connect_timeout_seconds: int = Field(default=3, ge=2)
    database_statement_timeout_ms: int = Field(default=1000, ge=1)
    control_artifact_root: Path | None = Field(default=None, repr=False)
    control_artifact_max_blob_bytes: int = Field(default=1048576, ge=1, le=1048576)
    control_repository_config: Path | None = Field(default=None, repr=False)

    @field_validator("database_url", mode="before")
    @classmethod
    def empty_database_url(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value


settings = Settings()
