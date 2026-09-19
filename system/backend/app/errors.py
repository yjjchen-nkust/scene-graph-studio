from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

MESSAGES: dict[str, tuple[str, str]] = {
    "bad_request": ("The request could not be understood.", "無法解析此請求。"),
    "not_found": ("No such resource.", "找不到此資源。"),
    "dangling_reference": (
        "A relationship references an object that is not in this graph.",
        "關係引用了不存在於本圖中的物件。",
    ),
    "schema_invalid": ("The request body failed validation.", "請求內容未通過結構驗證。"),
    "slice_images_missing": (
        "The annotations are present but the image files have not been unpacked.",
        "標註已存在，但影像檔尚未解壓縮。",
    ),
    "inference_unavailable": (
        "Live inference is not available for this model on this machine.",
        "此機器無法對本模型執行即時推論。",
    ),
    "vlm_unavailable": ("No live VLM provider is configured.", "尚未設定即時 VLM 供應者。"),
    "internal_error": ("An unexpected error occurred.", "發生未預期的錯誤。"),
}


DANGLING_MARKER = "reference object_ids not present in this graph"


def _clean_errors(errors: list[Any]) -> list[dict[str, Any]]:
    """Pydantic v2 puts the original exception object in ctx, which JSON cannot encode.

    Everything that is not a primitive is stringified. The message survives, which is the
    part a caller can act on; the exception instance would only have leaked a traceback.
    """
    out: list[dict[str, Any]] = []
    for err in errors:
        row: dict[str, Any] = {}
        for key, value in dict(err).items():
            if key == "ctx" and isinstance(value, dict):
                row[key] = {k: str(v) for k, v in value.items()}
            elif isinstance(value, (str, int, float, bool, type(None))):
                row[key] = value
            elif isinstance(value, (list, tuple)):
                row[key] = [v if isinstance(v, (str, int, float, bool)) else str(v) for v in value]
            else:
                row[key] = str(value)
        out.append(row)
    return out


def _is_dangling(errors: list[dict[str, Any]]) -> bool:
    """SRS 3's invariant gets its own code, per contracts 1.1, not a generic schema failure."""
    return any(DANGLING_MARKER in str(err.get("msg", "")) for err in errors)


class ApiError(Exception):
    def __init__(self, code: str, status: int, detail: Any = None) -> None:
        self.code, self.status, self.detail = code, status, detail


def _payload(code: str, detail: Any = None) -> dict[str, Any]:
    en, zh = MESSAGES.get(code, MESSAGES["internal_error"])
    body: dict[str, Any] = {"code": code, "message_en": en, "message_zh": zh}
    if detail is not None:
        body["detail"] = detail
    return {"error": body}


def install(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(status_code=exc.status, content=_payload(exc.code, exc.detail))

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = "not_found" if exc.status_code == 404 else "bad_request"
        return JSONResponse(status_code=exc.status_code, content=_payload(code))

    @app.exception_handler(RequestValidationError)
    async def _val(_: Request, exc: RequestValidationError) -> JSONResponse:
        errors = _clean_errors(exc.errors())
        code = "dangling_reference" if _is_dangling(errors) else "schema_invalid"
        return JSONResponse(status_code=422, content=_payload(code, errors))

    @app.exception_handler(Exception)
    async def _any(_: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=500, content=_payload("internal_error"))
