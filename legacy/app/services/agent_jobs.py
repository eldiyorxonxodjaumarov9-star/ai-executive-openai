"""In-memory async agent jobs for long-running analysis (Chrome extension polling)."""

from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Literal

from app.utils.logger import get_logger

logger = get_logger(__name__)

JobStatus = Literal["queued", "running", "completed", "failed"]


@dataclass
class AgentJob:
    job_id: str
    agent_name: str
    status: JobStatus = "queued"
    stage: str = "navbat"
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    result: dict[str, Any] | None = None
    error: str | None = None


class AgentJobStore:
    """Process-local job store (Render single instance)."""

    def __init__(self, *, ttl_seconds: int = 3600) -> None:
        self._jobs: dict[str, AgentJob] = {}
        self._lock = asyncio.Lock()
        self._ttl_seconds = ttl_seconds

    async def create(self, agent_name: str) -> AgentJob:
        await self._purge_expired()
        job = AgentJob(job_id=str(uuid.uuid4()), agent_name=agent_name)
        async with self._lock:
            self._jobs[job.job_id] = job
        return job

    async def get(self, job_id: str) -> AgentJob | None:
        async with self._lock:
            return self._jobs.get(job_id)

    async def set_status(
        self,
        job_id: str,
        *,
        status: JobStatus | None = None,
        stage: str | None = None,
        result: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> None:
        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return
            if status is not None:
                job.status = status
            if stage is not None:
                job.stage = stage
            if result is not None:
                job.result = result
            if error is not None:
                job.error = error
            job.updated_at = time.time()

    async def _purge_expired(self) -> None:
        cutoff = time.time() - self._ttl_seconds
        async with self._lock:
            expired = [jid for jid, j in self._jobs.items() if j.updated_at < cutoff]
            for jid in expired:
                del self._jobs[jid]


agent_job_store = AgentJobStore()
