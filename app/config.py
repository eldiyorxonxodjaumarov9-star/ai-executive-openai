"""Application configuration via environment variables."""

from functools import lru_cache
from pathlib import Path
from typing import Any, Literal, Self

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PROMPTS_DIR = PROJECT_ROOT / "prompts"

VALID_AGENTS = frozenset(
    {"ceo", "sales", "finance", "marketing", "customer_success", "hr"}
)

VALID_APP_ENVS = frozenset({"development", "staging", "production"})
VALID_AI_PROVIDERS = frozenset({"none", "openai", "claude", "gemini"})


def _strip_env_comment_suffix(text: str) -> str:
    """Remove accidental documentation text copied into env values."""
    cleaned = text.strip()
    if " (" in cleaned:
        cleaned = cleaned.split(" (", 1)[0].strip()
    return cleaned


def parse_bool_env(value: Any, *, default: bool = False) -> bool:
    """Parse boolean environment values from Render, .env, or shell."""
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value != 0

    text = _strip_env_comment_suffix(str(value)).lower()
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

    normalized = _strip_env_comment_suffix(str(value)).lower()
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
    app_name: str = "AI Executive Platform"
    app_env: Literal["development", "staging", "production"] = "production"
    debug: bool = False
    host: str = "0.0.0.0"
    port: int = 8000

    # Bitrix24
    bitrix24_webhook_url: str = Field(
        ...,
        description="Incoming webhook URL for Bitrix24 REST API",
    )

    # AI provider (none | openai | claude | gemini)
    ai_provider: str = Field(
        default="openai",
        description="Active AI provider: none, openai, claude, or gemini",
    )

    # OpenAI (primary — AI_PROVIDER=openai)
    openai_api_key: str = Field(
        default="",
        description="OpenAI API key",
    )
    openai_model: str = Field(
        default="gpt-4o-mini",
        description="OpenAI model name (Responses API)",
    )
    openai_max_output_tokens: int = Field(1200, ge=256, le=8192)
    openai_quick_max_output_tokens: int = Field(800, ge=128, le=2000)
    openai_timeout_seconds: float = Field(120.0, ge=15.0, le=600.0)
    openai_quick_timeout_seconds: float = Field(55.0, ge=15.0, le=120.0)
    openai_max_retries: int = Field(2, ge=0, le=5)

    # Anthropic Claude (legacy — AI_PROVIDER=claude only)
    anthropic_api_key: str = ""
    claude_model: str = Field(
        default="claude-sonnet-4-6",
        description="Legacy Claude model (AI_PROVIDER=claude only)",
    )

    # Google Gemini (optional — AI_PROVIDER=gemini)
    google_api_key: str = Field(
        default="",
        description="Google Gemini API key",
    )
    gemini_model: str = "gemini-2.0-flash"

    # Shared limits (full-report / legacy providers)
    claude_max_tokens: int = 4096
    claude_quick_max_tokens: int = Field(1000, ge=400, le=2000)
    claude_timeout_seconds: float = Field(480.0, ge=10.0, le=600.0)
    claude_quick_timeout_seconds: float = Field(55.0, ge=15.0, le=120.0)
    claude_max_retries: int = Field(2, ge=0, le=5)

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
    bitrix_timeout_seconds: float = Field(30.0, ge=5.0, le=120.0)
    bitrix_max_retries: int = Field(2, ge=0, le=5)

    # Claude.ai connector (optional)
    connector_secret: str = Field(
        default="",
        description="Optional secret for /tools/* and /claude/* (except /claude/health)",
    )
    public_base_url: str = Field(
        default="",
        description="Public base URL for connector manifest (e.g. https://your-app.onrender.com)",
    )
    cors_origins: str = Field(
        default="",
        description=(
            "Comma-separated allowed CORS origins for web dashboard "
            "(e.g. https://your-app.vercel.app,http://localhost:5173)"
        ),
    )
    frontend_url: str = Field(
        default="",
        description="Primary Vercel frontend URL (added to CORS if set)",
    )

    @property
    def telegram_enabled(self) -> bool:
        """True when both Telegram credentials are configured."""
        return bool(self.telegram_bot_token.strip() and self.telegram_chat_id.strip())

    @property
    def openai_configured(self) -> bool:
        """True when OPENAI_API_KEY is set (independent of AI_PROVIDER)."""
        return bool(self.openai_api_key.strip())

    @property
    def claude_legacy_configured(self) -> bool:
        """True when ANTHROPIC_API_KEY is set (legacy fallback)."""
        return bool(self.anthropic_api_key.strip())

    @property
    def gemini_configured(self) -> bool:
        """True when GOOGLE_API_KEY is set."""
        return bool(self.google_api_key.strip())

    @property
    def active_provider_configured(self) -> bool:
        """True when the active AI_PROVIDER has its required API key."""
        provider = self.ai_provider.strip().lower()
        if provider == "none":
            return True
        if provider == "openai":
            return self.openai_configured
        if provider == "claude":
            return self.claude_legacy_configured
        if provider == "gemini":
            return self.gemini_configured
        return False

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

    @field_validator(
        "anthropic_api_key",
        "openai_api_key",
        "google_api_key",
        mode="before",
    )
    @classmethod
    def coerce_optional_api_key(cls, value: Any) -> str:
        if value is None:
            return ""
        return str(value).strip()

    @field_validator("ai_provider", mode="before")
    @classmethod
    def coerce_ai_provider(cls, value: Any) -> str:
        if value is None or str(value).strip() == "":
            return "openai"
        normalized = _strip_env_comment_suffix(str(value)).lower()
        aliases = {
            "anthropic": "claude",
            "google": "gemini",
            "chatgpt": "openai",
            "off": "none",
            "disabled": "none",
            "template": "none",
        }
        return aliases.get(normalized, normalized)

    @field_validator("ai_provider")
    @classmethod
    def validate_ai_provider(cls, value: str) -> str:
        if value not in VALID_AI_PROVIDERS:
            valid = ", ".join(sorted(VALID_AI_PROVIDERS))
            raise ValueError(f"AI_PROVIDER noto'g'ri: '{value}'. Qo'llab-quvvatlanadi: {valid}")
        return value

    @field_validator("claude_model", mode="before")
    @classmethod
    def coerce_claude_model(cls, value: Any) -> str:
        if value is None or str(value).strip() == "":
            return "claude-sonnet-4-6"
        return str(value).strip()

    @model_validator(mode="after")
    def validate_active_provider_credentials(self) -> Self:
        """Require API key only for the selected AI provider — never both."""
        provider = self.ai_provider.strip().lower()
        if provider == "openai" and not self.openai_configured:
            raise ValueError(
                "OPENAI_API_KEY talab qilinadi — AI_PROVIDER=openai uchun kalitni sozlang."
            )
        if provider == "claude" and not self.claude_legacy_configured:
            raise ValueError(
                "ANTHROPIC_API_KEY talab qilinadi — AI_PROVIDER=claude uchun kalitni sozlang."
            )
        if provider == "gemini" and not self.gemini_configured:
            raise ValueError(
                "GOOGLE_API_KEY talab qilinadi — AI_PROVIDER=gemini uchun kalitni sozlang."
            )
        return self

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

    @property
    def cors_origin_list(self) -> list[str]:
        """Allowed browser origins for web dashboard + legacy clients."""
        origins: list[str] = [
            "https://claude.ai",
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ]
        for raw in (self.cors_origins, self.frontend_url):
            if not raw:
                continue
            for part in str(raw).split(","):
                origin = part.strip().rstrip("/")
                if origin and origin not in origins:
                    origins.append(origin)
        return origins


def log_ai_provider_startup(settings: Settings, logger: Any) -> None:
    """Log AI provider configuration at startup — never log API keys."""
    logger.info("AI provider: %s", settings.ai_provider)
    logger.info("OpenAI configured: %s", "yes" if settings.openai_configured else "no")
    logger.info(
        "Claude legacy configured: %s",
        "yes" if settings.claude_legacy_configured else "no",
    )


_startup_logged = False


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    global _startup_logged
    settings = Settings()
    if not _startup_logged:
        try:
            from app.utils.logger import get_logger

            log_ai_provider_startup(settings, get_logger("app.config"))
        except Exception:
            pass
        _startup_logged = True
    return settings
