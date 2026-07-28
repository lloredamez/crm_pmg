from abc import ABC, abstractmethod
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class BaseWhatsAppAdapter(ABC):
    @abstractmethod
    async def send_message(self, phone: str, content: str) -> Dict[str, Any]:
        """Send a text message via WhatsApp provider API."""
        pass

class MockWhatsAppAdapter(BaseWhatsAppAdapter):
    """
    Adapter Mock para simulação de envio de mensagens no WhatsApp.
    Permite fácil substituição por Evolution API ou Meta Cloud API no futuro.
    """
    async def send_message(self, phone: str, content: str) -> Dict[str, Any]:
        logger.info(f"[MockWhatsApp] Sending message to {phone}: '{content}'")
        return {
            "status": "sent",
            "external_id": f"mock_msg_{phone}_12345",
            "provider": "MockWhatsAppAdapter"
        }
