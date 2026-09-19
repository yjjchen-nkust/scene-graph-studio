from __future__ import annotations

from fastapi import FastAPI

from app import errors
from app.api import datasets as datasets_api
from app.api import eval as eval_api
from app.api import health
from app.api import models as models_api
from app.api import vlm as vlm_api


def create_app() -> FastAPI:
    app = FastAPI(title="Scene Graph Studio", version="0.1.0")
    errors.install(app)
    app.include_router(health.router, prefix="/api")
    app.include_router(eval_api.router, prefix="/api")
    app.include_router(datasets_api.router, prefix="/api")
    app.include_router(models_api.router, prefix="/api")
    app.include_router(vlm_api.router, prefix="/api")
    return app


app = create_app()
