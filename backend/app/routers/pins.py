"""Pinboard writes. Reads are included in /api/bootstrap and /api/u/{username}."""

from fastapi import APIRouter, Depends

from .. import db
from ..deps import CurrentUser, get_current_user
from ..schemas import BoardSettings, Pin, PinIn, PinPatch

router = APIRouter(prefix="/api", tags=["data"])

_COMMON_ERRORS = {
    401: {"description": "Authentication failed or missing bearer token."},
    503: {"description": "Supabase write configuration missing."},
}


@router.put(
    "/pinboard",
    status_code=204,
    summary="Save pinboard settings",
    response_description="Saved successfully.",
    responses=_COMMON_ERRORS,
)
async def save_pin_board(
    body: BoardSettings, user: CurrentUser = Depends(get_current_user)
) -> None:
    await db.upsert_pin_board(user.id, body.model_dump())


@router.post(
    "/pins",
    status_code=201,
    response_model=Pin,
    summary="Create a pin",
    response_description="Created pin with DB createdAt.",
    responses={**_COMMON_ERRORS, 409: {"description": "Duplicate pin id."}},
)
async def create_pin(
    body: PinIn, user: CurrentUser = Depends(get_current_user)
) -> Pin:
    row = await db.insert_pin({"user_id": user.id, **body.model_dump(mode="json")})
    return Pin(**row)


@router.patch(
    "/pins/{pin_id}",
    status_code=204,
    summary="Update a pin",
    response_description="Updated successfully.",
    responses=_COMMON_ERRORS,
)
async def update_pin(
    pin_id: str, body: PinPatch, user: CurrentUser = Depends(get_current_user)
) -> None:
    fields = body.model_dump(exclude_unset=True, mode="json")
    if not fields:
        return
    await db.patch_row("pins", pin_id, fields, user.id)


@router.delete(
    "/pins/{pin_id}",
    status_code=204,
    summary="Delete a pin",
    response_description="Deleted successfully.",
    responses=_COMMON_ERRORS,
)
async def delete_pin(
    pin_id: str, user: CurrentUser = Depends(get_current_user)
) -> None:
    await db.delete_rows("pins", "id", pin_id, user.id)
