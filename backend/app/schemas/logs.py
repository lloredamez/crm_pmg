from uuid import UUID
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class CalendarSummary(BaseModel):
    work_start_hour: int
    work_end_hour: int
    timezone: str
    work_days: List[int]


class ConsultantActivitySummary(BaseModel):
    user_id: UUID
    user_name: str
    role: str
    current_status: str
    unit_name: Optional[str] = None
    online_work_seconds: int
    online_total_seconds: int
    expected_work_seconds: int
    transitions_count: int


class ActivityLogItem(BaseModel):
    id: UUID
    user_id: UUID
    user_name: str
    unit_name: Optional[str] = None
    previous_status: Optional[str] = None
    new_status: str
    source: str
    changed_at: datetime


class ActivityLogsResponse(BaseModel):
    calendar_summary: CalendarSummary
    consultants: List[ConsultantActivitySummary]
    events: List[ActivityLogItem]
    total_events: int


class TransferLogItem(BaseModel):
    id: UUID
    lead_id: UUID
    lead_name: str
    lead_phone: Optional[str] = None
    channel_code: Optional[str] = None
    unit_name: Optional[str] = None
    event_type: str  # 'assigned', 'claimed_from_bucket', 'reassigned', 'sla_breached'
    attendant_id: Optional[UUID] = None
    attendant_name: Optional[str] = None
    reassigned_by_name: Optional[str] = None
    breach_type: Optional[str] = None
    title: str
    description: Optional[str] = None
    created_at: datetime


class TransferLogsResponse(BaseModel):
    items: List[TransferLogItem]
    total: int
    total_system_assigned: int
    total_claimed_from_bucket: int
    total_manual_reassigned: int
    total_breaches: int


class LeadChangeLogItem(BaseModel):
    id: UUID
    lead_id: UUID
    lead_name: str
    channel_code: Optional[str] = None
    unit_name: Optional[str] = None
    event_type: str
    attendant_id: Optional[UUID] = None
    attendant_name: Optional[str] = None
    title: str
    description: Optional[str] = None
    event_metadata: Optional[Dict[str, Any]] = None
    created_at: datetime


class LeadChangeLogsResponse(BaseModel):
    items: List[LeadChangeLogItem]
    total: int
