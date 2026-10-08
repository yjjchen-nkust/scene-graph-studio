from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import errors
from app.api import datasets as datasets_api
from app.api import eval as eval_api
from app.api import health
from app.api import models as models_api
from app.api import vlm as vlm_api


def create_app() -> FastAPI:
    app = FastAPI(title="Scene Graph Studio", version="0.1.0")
    errors.install(app)
    # Unset locally, where Vite proxies `/api` and the browser sees one origin. A static site on
    # another origin (GitHub Pages) needs its origin listed here, comma-separated, e.g.
    # SGS_CORS_ORIGINS=https://yjjchen-nkust.github.io. Read-only API, so only GET and POST.
    origins = [o.strip() for o in os.environ.get("SGS_CORS_ORIGINS", "").split(",") if o.strip()]
    if origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_methods=["GET", "POST"],
            allow_headers=["content-type"],
        )
    app.include_router(health.router, prefix="/api")
    app.include_router(eval_api.router, prefix="/api")
    app.include_router(datasets_api.router, prefix="/api")
    app.include_router(models_api.router, prefix="/api")
    app.include_router(vlm_api.router, prefix="/api")
    return app


app = create_app()
