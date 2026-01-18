from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
import uuid

import pandas as pd


@dataclass
class SessionState:
  session_id: str
  df: pd.DataFrame
  history: List[pd.DataFrame] = field(default_factory=list)
  model: Any = None
  task_type: Optional[str] = None  # "classification" | "regression"
  metrics: Dict[str, float] = field(default_factory=dict)


class SessionStore:
  def __init__(self) -> None:
    self._sessions: Dict[str, SessionState] = {}
    self._current_session_id: Optional[str] = None

  def create_session(self, df: pd.DataFrame) -> SessionState:
    session_id = str(uuid.uuid4())
    state = SessionState(session_id=session_id, df=df.copy(), history=[df.copy()])
    self._sessions[session_id] = state
    self._current_session_id = session_id
    return state

  def get_session(self, session_id: str) -> SessionState:
    if session_id not in self._sessions:
      raise KeyError(f"Session {session_id} not found")
    return self._sessions[session_id]

  def set_current(self, session_id: str) -> None:
    if session_id not in self._sessions:
      raise KeyError(f"Session {session_id} not found")
    self._current_session_id = session_id

  def get_current(self) -> SessionState:
    if not self._current_session_id:
      raise KeyError("No active session")
    return self.get_session(self._current_session_id)

  def snapshot(self, session_id: str) -> None:
    state = self.get_session(session_id)
    state.history.append(state.df.copy())
    self._current_session_id = session_id

  def undo(self, session_id: str) -> None:
    state = self.get_session(session_id)
    if len(state.history) > 1:
      state.history.pop()
      state.df = state.history[-1].copy()
    self._current_session_id = session_id

  def update_df(self, session_id: str, df: pd.DataFrame) -> SessionState:
    state = self.get_session(session_id)
    state.df = df
    state.history.append(df.copy())
    self._current_session_id = session_id
    return state

  def delete_session(self, session_id: str) -> None:
    if session_id in self._sessions:
      del self._sessions[session_id]
      if self._current_session_id == session_id:
        self._current_session_id = None


session_store = SessionStore()
