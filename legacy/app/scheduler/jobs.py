"""APScheduler jobs for daily reports."""

from __future__ import annotations

from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.agents.runner import AgentRunner
from app.config import Settings, get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

_scheduler: Optional[AsyncIOScheduler] = None


async def daily_report_job() -> None:
    """Scheduled job: run daily CEO (or configured) agent report."""
    logger.info("Daily report job started")
    try:
        runner = AgentRunner()
        result = await runner.run_daily_report()
        logger.info(
            "Daily report completed: agent=%s, telegram_chunks=%d",
            result.agent_name,
            result.telegram_chunks,
        )
    except Exception:
        logger.exception("Daily report job failed")


def create_scheduler(settings: Optional[Settings] = None) -> AsyncIOScheduler:
    """Create and configure the async scheduler."""
    settings = settings or get_settings()
    scheduler = AsyncIOScheduler(timezone=settings.daily_report_timezone)

    if settings.daily_report_enabled:
        trigger = CronTrigger(
            hour=settings.daily_report_hour,
            minute=settings.daily_report_minute,
            timezone=settings.daily_report_timezone,
        )
        scheduler.add_job(
            daily_report_job,
            trigger=trigger,
            id="daily_report",
            replace_existing=True,
            misfire_grace_time=3600,
        )
        logger.info(
            "Daily report scheduled at %02d:%02d %s (agent=%s)",
            settings.daily_report_hour,
            settings.daily_report_minute,
            settings.daily_report_timezone,
            settings.daily_report_agent,
        )
    else:
        logger.info("Daily report scheduler disabled")

    return scheduler


def get_scheduler() -> Optional[AsyncIOScheduler]:
    """Return the global scheduler instance."""
    return _scheduler


def set_scheduler(scheduler: AsyncIOScheduler) -> None:
    """Set the global scheduler instance."""
    global _scheduler
    _scheduler = scheduler


def start_scheduler(settings: Optional[Settings] = None) -> AsyncIOScheduler:
    """Create, store, and start the scheduler."""
    scheduler = create_scheduler(settings)
    set_scheduler(scheduler)
    scheduler.start()
    logger.info("Scheduler started")
    return scheduler


def shutdown_scheduler() -> None:
    """Shut down the global scheduler if running."""
    scheduler = get_scheduler()
    if scheduler and scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler shut down")
