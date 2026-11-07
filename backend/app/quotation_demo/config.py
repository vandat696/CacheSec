from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class QuotationSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_prefix="QUOTATION_", extra="ignore", hide_input_in_errors=True
    )

    database_url: SecretStr | None = Field(default=None, repr=False)
    database_connect_timeout_seconds: int = Field(default=3, ge=2)
    database_statement_timeout_ms: int = Field(default=1000, ge=1)
