"""Worker da fila: consome check_jobs enfileirados e roda o pipeline."""

import logging
import threading
import time

from . import db, db_admin
from .config import settings
from .pipeline.reference_runner import process_reference_job
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
            worked = False
            try:
                worked = self._run_next_check_job() or self._run_next_reference_job()
            except Exception:
                log.exception("falha ao consultar a fila")
                self._stop.wait(poll * 5)
                continue
            if not worked:
                self._stop.wait(poll)

    def _run_next_check_job(self) -> bool:
        job = db.claim_next_job()
        if job is None:
            return False
        job_id, check_id = str(job["id"]), str(job["check_id"])
        log.info("processando check job %s (check %s)", job_id, check_id)
        started = time.monotonic()
        try:
            process_job(job_id, check_id)
            log.info("check job %s concluído em %.1fs", job_id, time.monotonic() - started)
        except Exception as exc:
            log.exception("check job %s falhou", job_id)
            try:
                db.finish_job(job_id, error=f"{type(exc).__name__}: {exc}")
                db.set_check_status(check_id, "failed")
            except Exception:
                log.exception("falha ao registrar erro do job %s", job_id)
        return True

    def _run_next_reference_job(self) -> bool:
        job = db_admin.claim_next_reference_job()
        if job is None:
            return False
        job_id, item_id = str(job["id"]), str(job["reference_item_id"])
        log.info("processando referência %s (job %s)", item_id, job_id)
        started = time.monotonic()
        try:
            process_reference_job(job_id, item_id)
            log.info("reference job %s concluído em %.1fs", job_id, time.monotonic() - started)
        except Exception as exc:
            log.exception("reference job %s falhou", job_id)
            try:
                db_admin.finish_reference_job(job_id, error=f"{type(exc).__name__}: {exc}")
            except Exception:
                log.exception("falha ao registrar erro do reference job %s", job_id)
        return True
