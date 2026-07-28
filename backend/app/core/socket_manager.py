import socketio
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*'
)

socket_app = socketio.ASGIApp(
    socketio_server=sio,
    socketio_path='socket.io'
)

@sio.event
async def connect(sid: str, environ: Dict[str, Any]):
    logger.info(f"Client connected: {sid}")

@sio.event
async def disconnect(sid: str):
    logger.info(f"Client disconnected: {sid}")

@sio.event
async def join_attendant(sid: str, data: Dict[str, Any]):
    user_id = data.get("user_id")
    if user_id:
        room = f"user_{user_id}"
        await sio.enter_room(sid, room)
        logger.info(f"SID {sid} joined room {room}")

async def emit_lead_assigned(attendant_id: str, lead_data: dict):
    room = f"user_{attendant_id}"
    await sio.emit("lead:assigned", lead_data, room=room)
    await sio.emit("leads:updated", lead_data)  # Broadcast grid update

async def emit_lead_reassigned(old_attendant_id: str, new_attendant_id: str, lead_data: dict):
    if old_attendant_id:
        await sio.emit("lead:timeout_removed", {"lead_id": lead_data.get("id"), "reason": "SLA Timeout Exceeded"}, room=f"user_{old_attendant_id}")
    if new_attendant_id:
        await sio.emit("lead:assigned", lead_data, room=f"user_{new_attendant_id}")
    await sio.emit("leads:updated", lead_data)

async def emit_sla_warning(attendant_id: str, lead_data: dict):
    room = f"user_{attendant_id}"
    await sio.emit("sla:warning", lead_data, room=room)
