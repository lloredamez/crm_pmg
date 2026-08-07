import socketio
import logging
from typing import Dict, Any, Set

logger = logging.getLogger(__name__)

sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*'
)

socket_app = socketio.ASGIApp(
    socketio_server=sio,
    socketio_path='socket.io'
)

# Mapping sid -> user_id and user_id -> set of sids
sid_to_user: Dict[str, str] = {}
user_to_sids: Dict[str, Set[str]] = {}

@sio.event
async def connect(sid: str, environ: Dict[str, Any]):
    logger.info(f"Client connected: {sid}")

@sio.event
async def disconnect(sid: str):
    logger.info(f"Client disconnected: {sid}")
    user_id = sid_to_user.pop(sid, None)
    if user_id and user_id in user_to_sids:
        user_to_sids[user_id].discard(sid)
        if not user_to_sids[user_id]:
            del user_to_sids[user_id]
            try:
                from uuid import UUID
                from app.core.database import AsyncSessionLocal
                from app.features.users.service import UserService
                from app.schemas.user import UserUpdateStatus

                async with AsyncSessionLocal() as db:
                    service = UserService(db)
                    await service.update_status(UUID(user_id), UserUpdateStatus(status="offline"))
                logger.info(f"User {user_id} automatically set to offline on socket disconnect")
            except Exception as e:
                logger.error(f"Error setting user {user_id} offline on disconnect: {e}")

@sio.event
async def join_attendant(sid: str, data: Dict[str, Any]):
    user_id = data.get("user_id")
    if user_id:
        user_id_str = str(user_id)
        sid_to_user[sid] = user_id_str
        if user_id_str not in user_to_sids:
            user_to_sids[user_id_str] = set()
        user_to_sids[user_id_str].add(sid)

        room = f"user_{user_id_str}"
        await sio.enter_room(sid, room)
        logger.info(f"SID {sid} joined room {room}")

async def emit_lead_assigned(attendant_id: str, lead_data: dict):
    room = f"user_{attendant_id}"
    await sio.emit("lead:assigned", lead_data, room=room)
    await sio.emit("leads:updated", lead_data)  # Broadcast grid update

async def emit_lead_reassigned(old_attendant_id: str, new_attendant_id: str, lead_data: dict):
    if old_attendant_id and old_attendant_id != new_attendant_id:
        await sio.emit("lead:timeout_removed", {"lead_id": lead_data.get("id"), "reason": "SLA Timeout Exceeded"}, room=f"user_{old_attendant_id}")
    if new_attendant_id and old_attendant_id != new_attendant_id:
        await sio.emit("lead:assigned", lead_data, room=f"user_{new_attendant_id}")
    await sio.emit("leads:updated", lead_data)

async def emit_lead_updated(lead_data: dict):
    await sio.emit("leads:updated", lead_data)

async def emit_sla_warning(attendant_id: str, lead_data: dict):
    room = f"user_{attendant_id}"
    await sio.emit("sla:warning", lead_data, room=room)

async def emit_user_status_updated(user_id: Any, status: str, user_name: str = None):
    await sio.emit("user:status_updated", {
        "user_id": str(user_id),
        "status": status,
        "name": user_name
    })
