"""Application configuration via environment variables."""

from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROMPTS_DIR = PROJECT_ROOT / "prompts"

VALID_AGENTS = frozenset(
    {"ceo", "sales", "finance", "marketing", "customer_success", "hr"}
)

VALID_APP_ENVS = frozenset({"development", "staging", "production"})


def parse_bool_env(value: Any, *, default: bool = False) -> bool:
    """Parse boolean environment values from Render, .env, or shell."""
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value != 0

    text = str(value).strip().lower()
    if text in {"", "none", "null"}:
        return default
    if text in {"true", "1", "yes", "on"}:
        return True
    if text in {"false", "0", "no", "off"}:
        return False

    raise ValueError(f"Invalid boolean value: {value!r}")


def parse_app_env(value: Any) -> Literal["development", "staging", "production"]:
    """Parse APP_ENV from string values (Render-safe)."""
    if value is None or str(value).strip() == "":
        return "production"

    normalized = str(value).strip().lower()
    if normalized not in VALID_APP_ENVS:
        raise ValueError(
            f"APP_ENV must be one of: {', '.join(sorted(VALID_APP_ENVS))}"
        )
    return normalized  # type: ignore[return-value]


class Settings(BaseSettings):
    """Central configuration loaded from environment / .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "Bitrix24 Claude Integration"
    app_env: Literal["development", "staging", "production"] = "production"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000

    # Bitrix24
    bitrix24_webhook_url: str = Field(
        ...,
        description="Incoming webhook URL for Bitrix24 REST API",
    )

    # Anthropic
    anthropic_api_key: str = Field(..., description="Anthropic API key for Claude")
    claude_model: str = "claude-sonnet-4-6"
    claude_max_tokens: int = 4096

    # Telegram (optional — omit both to disable)
    telegram_bot_token: str = Field(
        default="",
        description="Optional Telegram Bot API token",
    )
    telegram_chat_id: str = Field(
        default="",
        description="Optional target chat ID for reports",
    )

    # Scheduler
    daily_report_enabled: bool = False
    daily_report_hour: int = Field(9, ge=0, le=23)
    daily_report_minute: int = Field(0, ge=0, le=59)
    daily_report_timezone: str = "Asia/Tashkent"
    daily_report_agent: str = "ceo"

    # Bitrix24 fetch limits
    bitrix_leads_limit: int = Field(50, ge=1, le=500)
    bitrix_deals_limit: int = Field(50, ge=1, le=500)
    bitrix_contacts_limit: int = Field(50, ge=1, le=500)
    bitrix_tasks_limit: int = Field(50, ge=1, le=500)

    # Claude.ai connector (optional)
    connector_secret: str = Field(
        default="",
        description="Optional secret for /tools/* and /claude/* (except /claude/health)",
    )
    public_base_url: str = Field(
        default="",
        description="Public base URL for connector manifest (e.g. https://your-app.onrender.com)",
    )

    @property
    def telegram_enabled(self) -> bool:
        """True when both Telegram credentials are configured."""
        return bool(self.telegram_bot_token.strip() and self.telegram_chat_id.strip())

    @field_validator("app_env", mode="before")
    @classmethod
    def coerce_app_env(cls, value: Any) -> str:
        return parse_app_env(value)

    @field_validator("debug", mode="before")
    @classmethod
    def coerce_debug(cls, value: Any) -> bool:
        return parse_bool_env(value, default=False)

    @field_validator("daily_report_enabled", mode="before")
    @classmethod
    def coerce_daily_report_enabled(cls, value: Any) -> bool:
        return parse_bool_env(value, default=False)

    @field_validator("connector_secret", "public_base_url", mode="before")
    @classmethod
    def coerce_optional_string(cls, value: Any) -> str:
        if value is None:
            return ""
        return str(value).strip()

    @field_validator("telegram_bot_token", "telegram_chat_id", mode="before")
    @classmethod
    def coerce_optional_telegram(cls, value: Any) -> str:
        if value is None:
            return ""
        return str(value).strip()

    @field_validator("bitrix24_webhook_url")
    @classmethod
    def validate_bitrix_url(cls, value: str) -> str:
        value = value.strip().rstrip("/")
        if not value.startswith("https://"):
            raise ValueError("BITRIX24_WEBHOOK_URL must be an HTTPS URL")
        return value

    @field_validator("daily_report_agent")
    @classmethod
    def validate_daily_agent(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in VALID_AGENTS:
            raise ValueError(
                f"daily_report_agent must be one of: {', '.join(sorted(VALID_AGENTS))}"
            )
        return normalized


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
