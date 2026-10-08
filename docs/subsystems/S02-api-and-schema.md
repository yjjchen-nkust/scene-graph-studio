# S2 API and schema

## 1. Purpose and boundary

DRAFT

## 2. Code and data

| Path | Role |
|---|---|
| `system/backend/app/__init__.py` | Package marker of the backend application |
| `system/backend/app/main.py` | FastAPI application, router and CORS wiring |
| `system/backend/app/api/` | Route modules: datasets, eval, health, models, vlm |
| `system/backend/app/schema.py` | Pydantic models of the scene graph and the API |
| `system/backend/app/errors.py` | Exception handlers and the error response shape |
| `system/backend/app/settings.py` | Roots, version and data directory settings |
| `system/backend/tests/test_eval_api.py` | Tests of the evaluation endpoint |
| `system/backend/tests/test_health.py` | Tests of the health endpoint |
| `system/backend/tests/test_schema.py` | Tests of the schema models |
| `system/backend/tests/test_cors.py` | Tests of the CORS configuration |

## 3. Interfaces

DRAFT

## 4. Current rules

DRAFT

## 5. Verification

DRAFT

## 6. Traps

DRAFT

## 7. History

DRAFT

## 8. Open items

DRAFT
