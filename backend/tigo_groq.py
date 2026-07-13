#!/usr/bin/env python3
########################################################################
#       AN OPEN/GROQ AI CLI INTEGRATION BY NWALI UGONNA EMMANUEL
#       GITHUB: https://github.com/Tigo-cmd/TigoAi
#       All contributions are welcome!!!
#       yea lets do some coding!!!!!!!!!!!!
#########################################################################
"""Source classes to handle all GroqAPI functionalities and trained models
                        BY Nwali Ugonna Emmanuel
 """

from __future__ import annotations
from groq import Groq
import subprocess
import os
import requests
from dotenv import load_dotenv

class TigoGroq:
    """this handles Api tokens and requests
    this class clones the GROQ init function and re-initializes the arguments
    so that when the class is called it set every functionality needed for the model to run
    """
    client = None
    _Apikey = os.getenv("GROQ_API_KEY")
    
    # EDITED PROMPT: Optimized for Wearable Spatial Intelligence
    context: list[dict[str, str]] = [
        {"role": "system", "content": (
            "You are TigoAI, the intelligent heart of the Tigo Wearable Glasses. "
            "You are a multimodal spatial assistant designed to help users navigate and understand the physical world. "
            "You receive voice commands and visual data (images/video snippets) from the smart glasses. "
            "Your personality is helpful, concise, and proactive. "
            "When a user asks 'What am I seeing?', describe the surroundings vividly but briefly. "
            "When they ask to 'Take a picture', acknowledge the action and provide context if needed. "
            "You are also a conversational partner—reply to messages naturally through the app's chat interface. "
            "Never provide dangerous physical advice. Always act as a reliable companion for the user's daily life. be concise when neccessary do not say too much when you don't have to."
        )}
    ]

    def __init__(self) -> None:
        """Constructor initialized at first call"""
        if self._Apikey is None:
            load_dotenv()
            self._Apikey = os.getenv("GROQ_API_KEY")
        
        if self._Apikey is None:
            raise ValueError("GROQ_API_KEY not found in environment or .env file")
            
        self.client = Groq(api_key=self._Apikey)

    def get_response_from_ai(self, message: str, history: list[dict[str, str]] = None):
        """returns response from the AI and messages to print to standard output"""
        messages = [self.context[0]]
        
        if history:
            messages.extend(history)
            messages.append({"role": "user", "content": message})
        else:
            # Fallback to local in-memory context
            messages.extend(self.context[1:])
            self.context.append({"role": "user", "content": message})
            messages.append({"role": "user", "content": message})
        
        # Using Llama 3.3 70B via Groq for high-speed wearable responses
        completion = self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.7, # Slightly lower temperature for more consistent assistant behavior
            max_tokens=1024,
            top_p=1,
            stream=True,
            stop=None,
        )
        
        reply: str = ""
        for chunk in completion:
            content = chunk.choices[0].delta.content
            if content:
                reply += content
                
        if not history:
            self.context.append({"role": "assistant", "content": reply})
            
        return reply

    def store_retrive_context(self, filename: str):
        """Placeholder for context persistence"""
        pass
