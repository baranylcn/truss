from fastapi import APIRouter, HTTPException

from ...services.session_store import session_store
from ...services.ml_pipeline import df_to_session_payload
from ...schemas.session import (
  SnapshotRequest,
  UndoRequest,
  SnapshotResponse,
  SessionCreateRequest,
  SessionUpdateRequest,
  SessionResponse,
)
import pandas as pd

router = APIRouter(prefix="/session", tags=["session"])


@router.post("/create", response_model=SessionResponse)
async def create_session(body: SessionCreateRequest):
  df = pd.DataFrame(body.data, columns=body.columns)
  state = session_store.create_session(df)
  return df_to_session_payload(state)


@router.get("/{id}", response_model=SessionResponse)
async def get_session(id: str):
  try:
    state = session_store.get_session(id)
    session_store.set_current(id)
  except KeyError:
    raise HTTPException(status_code=404, detail="Session not found")
  return df_to_session_payload(state)


@router.put("/{id}", response_model=SessionResponse)
async def update_session(id: str, body: SessionUpdateRequest):
  try:
    _ = session_store.get_session(id)
  except KeyError:
    raise HTTPException(status_code=404, detail="Session not found")
  df = pd.DataFrame(body.data, columns=body.columns)
  state = session_store.update_df(id, df)
  return df_to_session_payload(state)


@router.post("/{id}/snapshot", response_model=SnapshotResponse)
async def snapshot_session(id: str, body: SnapshotRequest):
  try:
    session_store.snapshot(id)
  except KeyError:
    raise HTTPException(status_code=404, detail="Session not found")
  return {"success": True}


@router.post("/{id}/undo", response_model=SessionResponse)
async def undo_session(id: str, body: UndoRequest):
  try:
    session_store.undo(id)
    state = session_store.get_session(id)
  except KeyError:
    raise HTTPException(status_code=404, detail="Session not found")
  return df_to_session_payload(state)


@router.delete("/{id}")
async def delete_session(id: str):
  session_store.delete_session(id)
  return {"success": True}
