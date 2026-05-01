"""
セッション管理モジュール

SessionStore インターフェースを定義し、
InMemorySessionStore で実装。
Redis版に切り替えるときは RedisSessionStore を実装して
main.py の初期化箇所を変えるだけでよい。

セッションデータ:
  - history: 直近N語（重複除外用）
  - used:    使用済み語セット（200語リセット用）
"""

from abc import ABC, abstractmethod
from collections import deque
from dataclasses import dataclass, field


# --- 設定 ---
HISTORY_SIZE = 10   # 直近何語を除外するか
USED_MAX = 200      # 何語使ったらリセットするか


@dataclass
class SessionData:
    history: deque[str] = field(default_factory=lambda: deque(maxlen=HISTORY_SIZE))
    used: set[str] = field(default_factory=set)

    def add(self, word: str) -> None:
        self.history.append(word)
        self.used.add(word)
        if len(self.used) >= USED_MAX:
            self.used = set()

    def is_recent(self, word: str) -> bool:
        return word in self.history

    def is_used(self, word: str) -> bool:
        return word in self.used


# --- インターフェース ---
class SessionStore(ABC):
    @abstractmethod
    def get(self, session_id: str) -> SessionData:
        """セッションを取得。存在しなければ新規作成して返す"""
        ...

    @abstractmethod
    def save(self, session_id: str, data: SessionData) -> None:
        """セッションを保存"""
        ...


# --- インメモリ実装 ---
class InMemorySessionStore(SessionStore):
    def __init__(self) -> None:
        self._store: dict[str, SessionData] = {}

    def get(self, session_id: str) -> SessionData:
        if session_id not in self._store:
            self._store[session_id] = SessionData()
        return self._store[session_id]

    def save(self, session_id: str, data: SessionData) -> None:
        self._store[session_id] = data


# --- Redis実装（後で差し替え）---
# class RedisSessionStore(SessionStore):
#     def __init__(self, redis_url: str) -> None:
#         import redis
#         self._r = redis.from_url(redis_url)
#         self._ttl = 60 * 60 * 3  # 3時間
#
#     def get(self, session_id: str) -> SessionData:
#         import pickle
#         raw = self._r.get(f"session:{session_id}")
#         if raw is None:
#             return SessionData()
#         return pickle.loads(raw)
#
#     def save(self, session_id: str, data: SessionData) -> None:
#         import pickle
#         self._r.setex(f"session:{session_id}", self._ttl, pickle.dumps(data))