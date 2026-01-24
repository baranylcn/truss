from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
import pandas as pd

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
from ...services.db import get_db
from ...services.models import MLSessions, MLSessionSnapshots
from ...utils.json_sanitize import sanitize_for_json

router = APIRouter(prefix="/session", tags=["session"])


async def _load_session_from_db(session_id: str, db: AsyncSession):
  result = await db.execute(
    select(MLSessions).where(MLSessions.session_id == session_id)
  )
  row = result.scalar_one_or_none()
  if row is None:
    return None

  current_data = row.current_data or {}
  data = current_data.get("data")
  columns = current_data.get("columns")

  if not data or not columns:
    return None

  df = pd.DataFrame(data, columns=columns)
  state = session_store.create_session(df, session_id=session_id)
  return state


async def _sync_session_to_db(state, db: AsyncSession, filename: str | None = None) -> None:
  payload = df_to_session_payload(state)
  df = state.df
  columns = payload["columns"]
  shape = list(payload["shape"])
  dtypes = {col: str(df[col].dtype) for col in columns}
  missing_values = payload["missing_values"]
  current_data = {
    "data": payload["data"],
    "columns": columns,
    "shape": shape,
  }

  current_data = sanitize_for_json(current_data)

  result = await db.execute(
    select(MLSessions).where(MLSessions.session_id == state.session_id)
  )
  row = result.scalar_one_or_none()

  if row is None:
    row = MLSessions(
      session_id=state.session_id,
      user_id=None,
      filename=filename,
      columns=columns,
      shape=shape,
      dtypes=dtypes,
      missing_values=missing_values,
      current_data=current_data,
    )
    db.add(row)
  else:
    if filename is not None:
      row.filename = filename
    row.columns = columns
    row.shape = shape
    row.dtypes = dtypes
    row.missing_values = missing_values
    row.current_data = current_data

  await db.commit()


@router.post("/create", response_model=SessionResponse)
async def create_session(
  body: SessionCreateRequest,
  db: AsyncSession = Depends(get_db),
):
  df = pd.DataFrame(body.data, columns=body.columns)
  state = session_store.create_session(df)

  await _sync_session_to_db(state, db)
  return df_to_session_payload(state)


@router.get("/{id}", response_model=SessionResponse)
async def get_session(
  id: str,
  db: AsyncSession = Depends(get_db),
):
  try:
    state = session_store.get_session(id)
    session_store.set_current(id)
  except KeyError:
    state = await _load_session_from_db(id, db)
    if state is None:
      raise HTTPException(status_code=404, detail="Session not found")

  return df_to_session_payload(state)


@router.put("/{id}", response_model=SessionResponse)
async def update_session(
  id: str,
  body: SessionUpdateRequest,
  db: AsyncSession = Depends(get_db),
):
  try:
    _ = session_store.get_session(id)
  except KeyError:
    state_loaded = await _load_session_from_db(id, db)
    if state_loaded is None:
      raise HTTPException(status_code=404, detail="Session not found")

  if not body.data or not body.columns or len(body.data) == 0 or len(body.columns) == 0:
    raise HTTPException(status_code=400, detail="Invalid data format: data and columns are required and cannot be empty")

  df = pd.DataFrame(body.data, columns=body.columns)
  state = session_store.update_df(id, df)

  await _sync_session_to_db(state, db)
  return df_to_session_payload(state)


@router.post("/{id}/snapshot", response_model=SnapshotResponse)
async def snapshot_session(
  id: str,
  body: SnapshotRequest,
  db: AsyncSession = Depends(get_db),
):
  try:
    session_store.snapshot(id)
    state = session_store.get_session(id)
  except KeyError:
    state = await _load_session_from_db(id, db)
    if state is None:
      raise HTTPException(status_code=404, detail="Session not found")
    session_store.snapshot(id)

  result = await db.execute(
    select(MLSessions).where(MLSessions.session_id == id)
  )
  session_row = result.scalar_one_or_none()
  if session_row is None:
    raise HTTPException(status_code=404, detail="Session not found")

  payload = df_to_session_payload(state)
  snapshot_data = {
    "data": payload["data"],
    "columns": payload["columns"],
    "shape": list(payload["shape"]),
  }
  snapshot_data = sanitize_for_json(snapshot_data)
  
  metadata = {
    "step_id": body.step_id,
  }

  snapshot_row = MLSessionSnapshots(
      session_id=session_row.id,
      step_id=body.step_id,
      step_name="manual_snapshot",
      data_snapshot=snapshot_data,
      meta=metadata
  )
  db.add(snapshot_row)
  await db.commit()

  return {"success": True}


@router.post("/{id}/undo", response_model=SessionResponse)
async def undo_session(
  id: str,
  body: UndoRequest,
  db: AsyncSession = Depends(get_db),
):
  try:
    session_store.undo(id)
    state = session_store.get_session(id)
  except KeyError:
    state_loaded = await _load_session_from_db(id, db)
    if state_loaded is None:
      raise HTTPException(status_code=404, detail="Session not found")
    try:
      session_store.undo(id)
      state = session_store.get_session(id)
    except Exception:
      state = state_loaded

  await _sync_session_to_db(state, db)
  return df_to_session_payload(state)


@router.delete("/{id}")
async def delete_session(
  id: str,
  db: AsyncSession = Depends(get_db),
):
  session_store.delete_session(id)

  await db.execute(
    delete(MLSessions).where(MLSessions.session_id == id)
  )
  await db.commit()

  return {"success": True}
