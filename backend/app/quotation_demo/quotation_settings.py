from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class QuotationSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_prefix="QUOTATION_", extra="ignore", hide_input_in_errors=True
    )

    database_url: SecretStr | None = Field(default=None, repr=False)
    database_connect_timeout_seconds: int = Field(default=3, ge=2)
    database_statement_timeout_ms: int = Field(default=1000, ge=1)
    fixture_reader_token: SecretStr | None = Field(default=None, repr=False)
    fixture_operator_token: SecretStr | None = Field(default=None, repr=False)
    max_page_size: int = Field(default=100, ge=1, le=100)
    max_body_bytes: int = Field(default=65536, ge=1, le=65536)
    cors_origins: list[str] = ["http://127.0.0.1:3000", "http://localhost:3000"]
