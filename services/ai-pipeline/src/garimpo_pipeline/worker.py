"""Worker da fila: consome check_jobs enfileirados e roda o pipeline."""

import logging
import threading
import time

from . import db
from .config import settings
from .pipeline.runner import process_job

log = logging.getLogger(__name__)


class Worker:
    def __init__(self) -> None:
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        if not settings().worker_enabled:
            log.info("worker desabilitado (WORKER_ENABLED=false)")
            return
        self._thread = threading.Thread(target=self._loop, name="pipeline-worker", daemon=True)
        self._thread.start()
        log.info("worker iniciado")

    def stop(self) -> None:
        self._stop.set()
        if self._thread is not None:
            self._thread.join(timeout=10)

    def _loop(self) -> None:
        poll = settings().worker_poll_seconds
        while not self._stop.is_set():
            try:
                job = db.claim_next_job()
            except Exception:
                log.exception("falha ao consultar a fila")
                self._stop.wait(poll * 5)
                continue

            if job is None:
                self._stop.wait(poll)
                continue

            job_id, check_id = str(job["id"]), str(job["check_id"])
            log.info("processando job %s (check %s)", job_id, check_id)
            started = time.monotonic()
            try:
                process_job(job_id, check_id)
                log.info("job %s concluído em %.1fs", job_id, time.monotonic() - started)
            except Exception as exc:
                log.exception("job %s falhou", job_id)
                try:
                    db.finish_job(job_id, error=f"{type(exc).__name__}: {exc}")
                    db.set_check_status(check_id, "failed")
                except Exception:
                    log.exception("falha ao registrar erro do job %s", job_id)
