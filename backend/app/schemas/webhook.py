from typing import Optional, Dict, Any, List
from pydantic import BaseModel

class MetaLeadPayload(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    meta_lead_id: Optional[str] = None
    campaign_name: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None

class MetaWebhookData(BaseModel):
    object: Optional[str] = "page"
    entry: Optional[List[Dict[str, Any]]] = None
