from openai import OpenAI
from anthropic import Anthropic
from typing import List, Dict, Optional, Any
import json
from app.config import settings


class LLMService:
    """
    Unified interface for LLM providers (OpenAI, Anthropic, Groq)
    """
    
    def __init__(
        self,
        provider: str = None,
        model: str = None
    ):
        self.provider = provider or settings.default_llm_provider
        self.model = model or settings.default_model
        
        # Initialize clients
        if self.provider == "openai":
            self.client = OpenAI(api_key=settings.openai_api_key)
        elif self.provider == "anthropic":
            self.client = Anthropic(api_key=settings.anthropic_api_key)
        elif self.provider == "groq":
            from groq import Groq
            self.client = Groq(api_key=settings.groq_api_key)
        else:
            raise ValueError(f"Unsupported provider: {self.provider}")
    
    def generate(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 2000,
        json_mode: bool = False
    ) -> str:
        """
        Generate completion from messages
        
        Args:
            messages: List of {"role": "user/assistant/system", "content": "..."}
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            json_mode: Whether to force JSON output
            
        Returns:
            Generated text
        """
        if self.provider == "openai":
            return self._generate_openai(messages, temperature, max_tokens, json_mode)
        elif self.provider == "anthropic":
            return self._generate_anthropic(messages, temperature, max_tokens, json_mode)
        elif self.provider == "groq":
            return self._generate_groq(messages, temperature, max_tokens, json_mode)
    
    def _generate_openai(
        self,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
        json_mode: bool
    ) -> str:
        """Generate using OpenAI API"""
        kwargs = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        
        response = self.client.chat.completions.create(**kwargs)
        return response.choices[0].message.content
    
    def _generate_anthropic(
        self,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
        json_mode: bool
    ) -> str:
        """Generate using Anthropic API"""
        # Extract system message if present
        system_message = None
        filtered_messages = []
        
        for msg in messages:
            if msg["role"] == "system":
                system_message = msg["content"]
            else:
                filtered_messages.append(msg)
        
        kwargs = {
            "model": self.model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": filtered_messages,
        }
        
        if system_message:
            kwargs["system"] = system_message
        
        response = self.client.messages.create(**kwargs)
        return response.content[0].text
    
    def _generate_groq(
        self,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
        json_mode: bool
    ) -> str:
        """Generate using Groq API"""
        kwargs = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
        
        response = self.client.chat.completions.create(**kwargs)
        return response.choices[0].message.content
    
    def generate_with_tools(
        self,
        messages: List[Dict[str, str]],
        tools: List[Dict],
        temperature: float = 0.7
    ) -> Dict[str, Any]:
        """
        Generate with function calling / tools
        """
        if self.provider == "openai":
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=tools,
                temperature=temperature,
            )
            
            message = response.choices[0].message
            
            return {
                "content": message.content,
                "tool_calls": message.tool_calls if hasattr(message, 'tool_calls') else None
            }
        else:
            # Anthropic and Groq have different tool calling formats
            raise NotImplementedError("Tool calling not implemented for this provider yet")
    
    def parse_json_response(self, response: str) -> Dict:
        """
        Parse JSON from LLM response, handling markdown code blocks
        """
        # Try to extract JSON from markdown code blocks
        import re
        
        # Remove markdown code blocks if present
        json_match = re.search(r'```json\s*(.*?)\s*```', response, re.DOTALL)
        if json_match:
            response = json_match.group(1)
        else:
            # Try without json marker
            json_match = re.search(r'```\s*(.*?)\s*```', response, re.DOTALL)
            if json_match:
                response = json_match.group(1)
        
        # Parse JSON
        try:
            return json.loads(response)
        except json.JSONDecodeError as e:
            # Try to fix common issues
            response = response.strip()
            if not response.startswith('{') and not response.startswith('['):
                # Find first { or [
                start = min(
                    response.find('{') if '{' in response else len(response),
                    response.find('[') if '[' in response else len(response)
                )
                response = response[start:]
            
            return json.loads(response)


class EmbeddingService:
    """
    Service for generating embeddings
    """
    
    def __init__(self, model: str = None):
        self.model = model or settings.embedding_model
        self.client = OpenAI(api_key=settings.openai_api_key)
    
    def embed_text(self, text: str) -> List[float]:
        """Generate embedding for a single text"""
        response = self.client.embeddings.create(
            model=self.model,
            input=text
        )
        return response.data[0].embedding
    
    def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts (batched)"""
        response = self.client.embeddings.create(
            model=self.model,
            input=texts
        )
        return [item.embedding for item in response.data]
    
    def get_embedding_dimension(self) -> int:
        """Get the dimension of embeddings for this model"""
        # text-embedding-3-small: 1536 dimensions
        # text-embedding-3-large: 3072 dimensions
        if "small" in self.model:
            return 1536
        elif "large" in self.model:
            return 3072
        else:
            return 1536  # default