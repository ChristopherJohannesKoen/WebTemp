from fastapi import APIRouter

router = APIRouter()


@router.get("/health", summary="Health check")
async def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
