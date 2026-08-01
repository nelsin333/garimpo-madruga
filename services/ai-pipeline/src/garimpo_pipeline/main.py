"""Entrada do serviço: API FastAPI + worker da fila no mesmo processo."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from . import db
from .api.routes import router
from .worker import Worker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

worker = Worker()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    worker.start()
    yield
    worker.stop()
    db.close_pool()


app = FastAPI(title="Garimpo Madruga — Motor de Autenticação", lifespan=lifespan)
app.include_router(router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
