from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from groq import Groq
import os
import datetime
import uuid
import threading
import subprocess
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client
from tigo_groq import TigoGroq

load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize Clients
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
SUPABASE_URL = os.getenv("EXPO_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("EXPO_PUBLIC_SUPABASE_ANON_KEY")

groq_client = Groq(api_key=GROQ_API_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
tigo_ai = TigoGroq()

# Directories
UPLOAD_FOLDER = 'uploads'
AUDIO_FOLDER = Path(UPLOAD_FOLDER) / 'audio'
RAW_UPLOAD_DIR = Path(UPLOAD_FOLDER) / 'raw'
CONVERTED_DIR = Path(UPLOAD_FOLDER) / 'converted'
os.makedirs(RAW_UPLOAD_DIR, exist_ok=True)
os.makedirs(CONVERTED_DIR, exist_ok=True)
os.makedirs(AUDIO_FOLDER, exist_ok=True)

DIRECT_EXTS = ['.wav', '.mp3', '.ogg', '.webm']
SUPPORTED_VOICES = [
    "autumn", "diana", "hannah", "austin", "daniel", "troy"
]

tasks = {} # Map taskId to path for async check pattern
command_queue = {} # Map deviceId to list of pending commands

@app.route('/get_commands/<device_id>', methods=['GET'])
def get_commands(device_id):
    """Endpoint for ESP32 to poll for pending commands from the app"""
    commands = command_queue.get(device_id, [])
    command_queue[device_id] = [] # Clear once fetched
    return jsonify({"commands": commands}), 200

@app.route('/send_command', methods=['POST'])
def send_command():
    """Endpoint for Android app to send a command to a device"""
    data = request.get_json(force=True)
    device_id = data.get('device_id')
    command = data.get('command')
    
    if not device_id or not command:
        return jsonify({"error": "device_id and command required"}), 400
        
    if device_id not in command_queue:
        command_queue[device_id] = []
        
    command_queue[device_id].append(command)
    return jsonify({"status": "command_queued"}), 200

@app.route('/transcribe_text', methods=['POST'])
def transcribe_text():
    """Endpoint for Android app to send text messages to TigoAI"""
    data = request.get_json(force=True)
    message = data.get('message')
    user_id = data.get('user_id', 'default_user')
    device_id = data.get('device_id', 'esp32_01')
    print(f"Received request to /transcribe_text from user: {user_id}")
    
    if not message:
        return jsonify({"error": "message required"}), 400
        
    response = process_command(message, user_id, device_id)
    return jsonify(response), 200

@app.route('/transcribe', methods=['POST'])
def transcribe_audio():
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400
    
    file = request.files['file']
    user_id = request.form.get('user_id', 'default_user')
    device_id = request.form.get('device_id', 'esp32_01')

    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    unique_id = uuid.uuid4().hex
    timestamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S')
    ext = os.path.splitext(file.filename)[1].lower() or '.wav'
    raw_path = RAW_UPLOAD_DIR / f"{timestamp}_{unique_id}{ext}"
    
    file.save(raw_path)

    try:
        with open(raw_path, 'rb') as f:
            transcript = groq_client.audio.transcriptions.create(
                file=(os.path.basename(raw_path), f.read()),
                model="whisper-large-v3",
                timeout=120
            )
        text = transcript.text

        response = process_command(text, user_id, device_id)
        
        return jsonify({
            "transcription": text,
            "ai_response": response
        }), 200

    except Exception as e:
        return jsonify({"error": f"Transcription failed: {str(e)}"}), 500
    finally:
        if os.path.exists(raw_path):
            os.remove(raw_path)

@app.route('/upload_media', methods=['POST'])
def upload_media():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
    
    file = request.files['file']
    user_id = request.form.get('user_id', 'default_user')
    device_id = request.form.get('device_id', 'esp32_01')
    
    if file.filename == '':
        return jsonify({"error": "No file"}), 400

    filename = f"{uuid.uuid4()}_{file.filename}"
    temp_path = Path(UPLOAD_FOLDER) / filename
    file.save(temp_path)

    try:
        with open(temp_path, 'rb') as f:
            storage_path = f"{user_id}/{filename}"
            supabase.storage.from_('media').upload(storage_path, f.read())
        
        public_url = supabase.storage.from_('media').get_public_url(storage_path)

        media_data = {
            "user_id": user_id,
            "url": public_url,  # Changed back to 'url' to match your Supabase schema
            "type": "image" if filename.lower().endswith(('.jpg', '.jpeg', '.png')) else "video",
            "device_id": device_id,
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        supabase.table('media_items').insert(media_data).execute()

        analysis = {"caption": "Visual analysis currently unavailable.", "tags": ["error"]}
        if media_data["type"] == "image":
            analysis = analyze_vision(public_url)
            # Update with both individual fields for the app and the full analysis object
            update_data = {
                "ai_caption": analysis.get('caption', ''),
                "ai_tags": analysis.get('tags', []),
                "analysis": analysis
            }
            supabase.table('media_items').update(update_data).eq("url", public_url).execute()

        return jsonify({
            "status": "success",
            "url": public_url,
            "analysis": analysis
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

import json
import re

def analyze_vision(image_url):
    try:
        completion = groq_client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct", # Use correct vision model in production if scout doesn't work well
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Describe this image in professional detail. Return ONLY a valid JSON object with two fields: 'caption' (string) and 'tags' (array of strings, max 3 tags). Do not use markdown blocks."},
                        {"type": "image_url", "image_url": {"url": image_url}}
                    ]
                }
            ]
        )
        content = completion.choices[0].message.content.strip()
        # Find JSON block if it tried to output markdown
        if content.startswith('```'):
            content = re.sub(r'```(?:json)?\n?(.*?)\n?```', r'\1', content, flags=re.DOTALL)
        
        return json.loads(content)
    except Exception as e:
        print(f"Vision error: {e}")
        return {"caption": "Visual analysis currently unavailable.", "tags": ["error"]}

@app.route("/analyze_media", methods=["POST"])
def analyze_media_endpoint():
    try:
        data = request.get_json(force=True)
        image_url = data.get("imageUri")
        if not image_url:
            return jsonify({"error": "imageUri is required"}), 400
            
        result = analyze_vision(image_url)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- NEW TTS ENDPOINTS (Following User Example) ---

@app.route("/api/tts", methods=["POST"])
def tts():
    try:
        data = request.get_json(force=True)
        text = data.get("text", "").strip()
        voice = data.get("voice", "troy")

        if not text:
            return jsonify({"message": "Missing required 'text' field."}), 400

        if voice not in SUPPORTED_VOICES:
            return jsonify({"message": f"Unsupported voice '{voice}'"}), 400

        task_id = uuid.uuid4().hex
        out_path = AUDIO_FOLDER / f"{task_id}.wav"

        response = groq_client.audio.speech.create(
            model="canopylabs/orpheus-v1-english",
            voice=voice,
            input=text,
            response_format="wav"
        )
        response.write_to_file(out_path)

        tasks[task_id] = out_path
        return jsonify({"taskId": task_id}), 200

    except Exception as e:
        if 'model_terms_required' in str(e):
            return jsonify({
                "message": "Please accept the terms at https://console.groq.com/playground?model=canopylabs/orpheus-v1-english"
            }), 400
        return jsonify({"message": f"Server error: {str(e)}"}), 500

@app.route("/api/tts/<task_id>", methods=["GET"])
def get_audio(task_id):
    path = tasks.get(task_id)
    if not path or not path.exists():
        return "", 202
    return send_file(path, mimetype="audio/wav")

@app.route("/api/tts/voices", methods=["GET"])
def list_voices():
    voices = [
        {"id": "autumn", "name": "Autumn", "language": "en-US", "gender": "female"},
        {"id": "diana", "name": "Diana", "language": "en-US", "gender": "female"},
        {"id": "hannah", "name": "Hannah", "language": "en-US", "gender": "female"},
        {"id": "austin", "name": "Austin", "language": "en-US", "gender": "male"},
        {"id": "daniel", "name": "Daniel", "language": "en-US", "gender": "male"},
        {"id": "troy", "name": "Troy", "language": "en-US", "gender": "male"}
    ]
    return jsonify(voices)

def generate_orpheus_response(text, message_id):
    """Internal helper to generate Groq Orpheus TTS"""
    try:
        out_path = AUDIO_FOLDER / f"{message_id}.wav"
        response = groq_client.audio.speech.create(
            model="canopylabs/orpheus-v1-english",
            voice="troy",
            input=text,
            response_format="wav"
        )
        response.write_to_file(out_path)
        tasks[message_id] = out_path
        return True
    except Exception as e:
        print(f"Orpheus TTS Error: {e}")
        return False

def process_command(text, user_id, device_id):
    """Processes a command using TigoAI and logs to Supabase if available"""
    try:
        command_log = {
            "user_id": user_id,
            "content": text,
            "role": "user",
            "device_id": device_id,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        supabase.table('chat_messages').insert(command_log).execute()
    except Exception as e:
        print(f"PostgreSQL/Supabase Error (user msg): {e}")

    # Use the TigoGroq AI to get a real response
    try:
        response_text = tigo_ai.get_response_from_ai(text)
    except Exception as e:
        print(f"AI Error: {e}")
        response_text = "I'm having trouble connecting to my brain right now. Please try again."

    assistant_msg_id = str(uuid.uuid4())
    try:
        ai_log = {
            "user_id": user_id,
            "content": response_text,
            "role": "assistant",
            "device_id": device_id,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }
        res = supabase.table('chat_messages').insert(ai_log).execute()
        if res.data:
            assistant_msg_id = res.data[0]['id']
    except Exception as e:
        print(f"PostgreSQL/Supabase Error (ai msg): {e}")

    # Generate high-quality voice in background to avoid blocking the app
    threading.Thread(target=generate_orpheus_response, args=(response_text, assistant_msg_id)).start()
    
    return {
        "text": response_text,
        "audio_url": f"/api/tts/{assistant_msg_id}"
    }

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
