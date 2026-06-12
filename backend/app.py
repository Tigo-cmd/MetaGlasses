from flask import Flask, request, jsonify, send_file, Response
from flask_cors import CORS
from groq import Groq
import os
import datetime
import uuid
import threading
import subprocess
import wave
import struct
import time
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

# --- Smart Glasses Button Command Integration Variables ---
SAMPLE_RATE = 16000
SAMPLE_WIDTH = 2
TARGET_PEAK = 28000

recording_data = bytearray()
is_recording = False
current_basename = None
last_recording_pcm = b""
last_wav_path = ""

cam_command = "idle"
c3_command = "idle"
device_status_store = {}
pending_snapshot_session = None
camera_frames = {}
camera_done_event = threading.Event()

state_lock = threading.Lock()

@app.route('/get_commands/<device_id>', methods=['GET'])
def get_commands(device_id):
    """Endpoint for ESP32 to poll for pending commands from the app"""
    commands = command_queue.get(device_id, [])
    command_queue[device_id] = [] # Clear once fetched
    return jsonify({"commands": commands}), 200

@app.route('/send_command', methods=['POST'])
def send_command():
    """Endpoint for Android app to send a command to a device"""
    global cam_command, pending_snapshot_session
    data = request.get_json(force=True)
    device_id = data.get('device_id')
    command = data.get('command')
    
    if not device_id or not command:
        return jsonify({"error": "device_id and command required"}), 400
        
    if device_id not in command_queue:
        command_queue[device_id] = []
        
    command_queue[device_id].append(command)
    
    # If mobile app requests a photo, route it to the ESP32-CAM session
    if command == 'take_photo':
        session_id = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        camera_done_event.clear()
        with state_lock:
            pending_snapshot_session = session_id
            camera_frames[session_id] = []
            cam_command = f"snapshot2|{session_id}"
        print(f"Mobile app requested photo: triggered camera command {cam_command}")
        
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
    global c3_command
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
        
        # Extract and set PCM for physical glasses playback
        extract_and_set_playback_pcm(out_path)
        
        # Queue command for ESP32-C3 to play response
        with state_lock:
            c3_command = "play_response"
            
        return True
    except Exception as e:
        print(f"Orpheus TTS Error: {e}")
        return False

def resample_pcm16(data: bytes, in_rate: int, out_rate: int) -> bytes:
    if in_rate == out_rate:
        return data
    import struct
    num_samples = len(data) // 2
    samples = struct.unpack(f"<{num_samples}h", data)
    
    duration = num_samples / in_rate
    out_samples_count = int(duration * out_rate)
    out_samples = []
    for i in range(out_samples_count):
        pos = i * (in_rate / out_rate)
        idx = int(pos)
        frac = pos - idx
        if idx >= num_samples - 1:
            out_samples.append(samples[-1])
        else:
            val = int(samples[idx] * (1.0 - frac) + samples[idx + 1] * frac)
            out_samples.append(val)
    return struct.pack(f"<{len(out_samples)}h", *out_samples)

def clamp_int16(value):
    return max(-32768, min(32767, int(value)))

def normalize_pcm16(pcm_bytes):
    if len(pcm_bytes) < 2:
        return b""

    sample_count = len(pcm_bytes) // 2
    samples = list(struct.unpack("<" + "h" * sample_count, pcm_bytes[:sample_count * 2]))
    peak = max(abs(sample) for sample in samples) if samples else 0

    if peak <= 0:
        return pcm_bytes

    gain = TARGET_PEAK / peak
    if gain < 1.0:
        gain = 1.0

    print(f"Playback gain: {gain:.2f}x | peak before: {peak}")
    normalized = [clamp_int16(sample * gain) for sample in samples]
    return b"".join(struct.pack("<h", sample) for sample in normalized)

def extract_and_set_playback_pcm(wav_path):
    global last_recording_pcm
    try:
        with wave.open(str(wav_path), 'rb') as w:
            n_channels = w.getnchannels()
            sampwidth = w.getsampwidth()
            framerate = w.getframerate()
            n_frames = w.getnframes()
            raw_frames = w.readframes(n_frames)
            
            pcm_data = raw_frames
            if n_channels == 2:
                mono_pcm = bytearray()
                for i in range(0, len(raw_frames), 4):
                    mono_pcm.extend(raw_frames[i:i+2])
                pcm_data = bytes(mono_pcm)
                
            if framerate != 16000:
                pcm_data = resample_pcm16(pcm_data, framerate, 16000)
                
            with state_lock:
                last_recording_pcm = normalize_pcm16(pcm_data)
                
            print(f"Extracted and normalized TTS response: {len(last_recording_pcm)} bytes at 16kHz Mono PCM16")
    except Exception as e:
        print(f"Error extracting PCM from TTS WAV: {e}")

def save_mjpeg(session_id, frame_paths):
    folder = os.path.join("snapshots", session_id)
    os.makedirs(folder, exist_ok=True)
    output_path = os.path.join(folder, f"{session_id}.mjpeg")

    boundary = b"--smartglassesframe\r\n"
    with open(output_path, "wb") as output:
        for frame_path in sorted(frame_paths):
            with open(frame_path, "rb") as frame:
                data = frame.read()

            output.write(boundary)
            output.write(b"Content-Type: image/jpeg\r\n")
            output.write(f"Content-Length: {len(data)}\r\n\r\n".encode("ascii"))
            output.write(data)
            output.write(b"\r\n")
            time.sleep(0.01)

        output.write(b"--smartglassesframe--\r\n")

    return os.path.abspath(output_path)

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

    # Check if this is a vision command requesting visual feedback
    is_vision_cmd = any(phrase in text.lower() for phrase in [
        "what am i seeing", "what is this", "what do you see",
        "describe this", "describe what you see", "look at this",
        "what am i looking at", "take a photo", "take a picture"
    ])

    vision_context = ""

    if is_vision_cmd:
        print("Vision command detected! Triggering ESP32-CAM snapshot...")
        global cam_command, pending_snapshot_session
        session_id = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        camera_done_event.clear()
        with state_lock:
            pending_snapshot_session = session_id
            camera_frames[session_id] = []
            cam_command = f"snapshot2|{session_id}"

        # Wait for the camera to upload frames (up to 10 seconds)
        print("Waiting for camera frames...")
        completed = camera_done_event.wait(timeout=10.0)
        
        if completed:
            with state_lock:
                frames = list(camera_frames.get(session_id, []))
            
            if frames:
                latest_frame = sorted(frames)[-1]
                print(f"Camera captured frame: {latest_frame}. Analyzing...")
                
                try:
                    filename = f"{uuid.uuid4()}_{os.path.basename(latest_frame)}"
                    with open(latest_frame, 'rb') as f:
                        storage_path = f"{user_id}/{filename}"
                        supabase.storage.from_('media').upload(storage_path, f.read())
                    
                    public_url = supabase.storage.from_('media').get_public_url(storage_path)

                    # Analyze the image
                    analysis = analyze_vision(public_url)
                    caption = analysis.get('caption', 'an image')
                    tags = analysis.get('tags', [])
                    print(f"Vision analysis results: {caption}")
                    
                    vision_context = f"[Context: The glasses camera captured an image. Vision Analysis says: {caption}]"

                    # Log the media item in Supabase database so it displays in the app gallery
                    media_data = {
                        "user_id": user_id,
                        "url": public_url,
                        "type": "image",
                        "device_id": device_id,
                        "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                        "ai_caption": caption,
                        "ai_tags": tags,
                        "analysis": analysis
                    }
                    supabase.table('media_items').insert(media_data).execute()

                except Exception as ve:
                    print(f"Vision capture processing error: {ve}")
                    vision_context = "[Context: The camera took a picture but visual analysis failed.]"
            else:
                print("No frames uploaded by camera.")
                vision_context = "[Context: The camera failed to capture a frame.]"
        else:
            print("Camera snapshot timeout.")
            vision_context = "[Context: Camera failed to respond or is offline.]"

    # Retrieve recent conversation context from Supabase for memory
    history_list = []
    try:
        history_res = supabase.table('chat_messages')\
            .select('role', 'content')\
            .eq('user_id', user_id)\
            .order('timestamp', desc=True)\
            .limit(10)\
            .execute()
        
        if history_res.data:
            db_msgs = history_res.data
            # Exclude the user message we just logged at the top of process_command
            if db_msgs and db_msgs[0].get("role") == "user" and db_msgs[0].get("content") == text:
                db_msgs = db_msgs[1:]
            
            for msg in reversed(db_msgs):
                history_list.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", "")
                })
    except Exception as he:
        print(f"Error loading chat history for memory: {he}")

    if vision_context:
        history_list.append({
            "role": "system",
            "content": vision_context
        })

    # Use the TigoGroq AI to get a real response with context memory
    try:
        response_text = tigo_ai.get_response_from_ai(text, history=history_list)
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

# ===================== ESP32-C3 AUDIO ROUTES =====================
@app.route("/start", methods=["POST"])
def start_recording():
    global recording_data, is_recording, current_basename, last_recording_pcm
    user_id = request.args.get('user_id', 'default_user')
    device_id = request.args.get('device_id', 'esp32_01')

    with state_lock:
        recording_data = bytearray()
        is_recording = True
        last_recording_pcm = b""  # Clear previous response
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        current_basename = f"button_command_recording_{timestamp}"

    print(f"\nRecording started for user: {user_id}, device: {device_id} -> {current_basename}")
    return "STARTED", 200

@app.route("/chunk", methods=["POST"])
def receive_chunk():
    global recording_data
    with state_lock:
        recording = is_recording

    if not recording:
        return "NOT_RECORDING", 400

    data = request.data
    with state_lock:
        recording_data.extend(data)
        total = len(recording_data)

    print(f"Chunk received: {len(data)} bytes | Total: {total} bytes")
    return "CHUNK_OK", 200

@app.route("/stop", methods=["POST"])
def stop_recording():
    global is_recording, last_wav_path
    user_id = request.args.get('user_id', 'default_user')
    device_id = request.args.get('device_id', 'esp32_01')

    with state_lock:
        if not is_recording:
            return "NOT_RECORDING", 400
        is_recording = False
        basename = current_basename
        audio_bytes = bytes(recording_data)

    raw_path = RAW_UPLOAD_DIR / f"{basename}.raw"
    wav_path = CONVERTED_DIR / f"{basename}.wav"

    with open(raw_path, "wb") as raw_file:
        raw_file.write(audio_bytes)

    with wave.open(str(wav_path), "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(SAMPLE_WIDTH)
        wav_file.setframerate(SAMPLE_RATE)
        wav_file.writeframes(audio_bytes)

    with state_lock:
        last_wav_path = os.path.abspath(wav_path)

    duration = len(audio_bytes) / (SAMPLE_RATE * SAMPLE_WIDTH)
    print(f"\nRecording stopped. Saved WAV: {wav_path} (Duration: {duration:.2f}s)")

    # Run transcription and LLM/TTS logic in a background thread to prevent blocking ESP32
    def process_voice_async(w_path, uid, did):
        try:
            with open(w_path, 'rb') as f:
                transcript = groq_client.audio.transcriptions.create(
                    file=(os.path.basename(w_path), f.read()),
                    model="whisper-large-v3",
                    timeout=120
                )
            text = transcript.text.strip()
            print(f"Transcribed voice command: {text}")
            if text:
                process_command(text, uid, did)
            else:
                print("Voice command transcription was empty.")
        except Exception as e:
            print(f"Failed to process voice command: {e}")

    threading.Thread(target=process_voice_async, args=(wav_path, user_id, device_id)).start()
    return "SAVED", 200

@app.route("/prepare_playback", methods=["POST"])
def prepare_playback():
    with state_lock:
        has_audio = bool(last_recording_pcm)
        wav_path = last_wav_path

    if not has_audio:
        print("Playback requested, but no AI response is ready yet.")
        return "NO_RECORDING", 404

    print(f"Playback ready: {wav_path}")
    return "PLAYBACK_READY", 200

@app.route("/last_recording_pcm", methods=["GET"])
def last_recording():
    with state_lock:
        pcm = last_recording_pcm

    if not pcm:
        return "NO_RECORDING", 404

    return Response(pcm, mimetype="application/octet-stream")

# ===================== CAMERA SNAPSHOT ROUTES =====================
@app.route("/snapshot2", methods=["POST"])
def snapshot2():
    global cam_command, pending_snapshot_session
    session_id = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    camera_done_event.clear()

    with state_lock:
        pending_snapshot_session = session_id
        camera_frames[session_id] = []
        cam_command = f"snapshot2|{session_id}"

    print(f"Snapshot command queued: {cam_command}")
    return "SNAPSHOT_QUEUED", 200

@app.route("/video", methods=["POST"])
def video_command():
    global cam_command, pending_snapshot_session
    session_id = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    camera_done_event.clear()

    with state_lock:
        pending_snapshot_session = session_id
        camera_frames[session_id] = []
        cam_command = f"video|{session_id}"

    print(f"Video command queued: {cam_command}")
    return "VIDEO_QUEUED", 200

@app.route("/cam_command", methods=["GET"])
def get_cam_command():
    global cam_command
    with state_lock:
        command = cam_command
        if cam_command != "idle":
            cam_command = "idle"

    if command != "idle":
        print(f"ESP32-CAM command delivered: {command}")

    return command, 200

@app.route("/c3_command", methods=["GET"])
def get_c3_command():
    global c3_command
    
    device_id = request.args.get('device_id')
    if device_id:
        try:
            battery = int(request.args.get('battery', '100'))
        except ValueError:
            battery = 100
            
        try:
            storage_used = float(request.args.get('storage_used', '0.0'))
        except ValueError:
            storage_used = 0.0
            
        try:
            storage_total = float(request.args.get('storage_total', '0.0'))
        except ValueError:
            storage_total = 0.0
            
        model = request.args.get('model', 'TigoAI ESP32-C3')
        
        with state_lock:
            device_status_store[device_id] = {
                "battery": battery,
                "storage_used": storage_used,
                "storage_total": storage_total,
                "model": model,
                "last_seen": time.time()
            }

    with state_lock:
        command = c3_command
        if c3_command != "idle":
            c3_command = "idle"

    if command != "idle":
        print(f"ESP32-C3 command delivered: {command}")

    return command, 200

@app.route("/device_status/<device_id>", methods=["GET"])
def get_device_status(device_id):
    with state_lock:
        status = device_status_store.get(device_id)
        
    if not status:
        return jsonify({
            "connected": False,
            "battery": 0,
            "storage": {
                "used": 0.0,
                "total": 0.0
            },
            "model": "TIGOAI SmartGlasses"
        }), 200
        
    is_connected = (time.time() - status["last_seen"]) < 3.0
    
    return jsonify({
        "connected": is_connected,
        "battery": status["battery"],
        "storage": {
            "used": status["storage_used"],
            "total": status["storage_total"]
        },
        "model": status["model"] if is_connected else "TIGOAI SmartGlasses",
        "lastSync": int(status["last_seen"] * 1000)
    }), 200

@app.route("/cam_frame", methods=["POST"])
def receive_cam_frame():
    session_id = request.headers.get("X-Session-ID", "unknown_session")
    frame_id = request.headers.get("X-Frame-ID", "0")

    folder = os.path.join("snapshots", session_id)
    os.makedirs(folder, exist_ok=True)

    filename = os.path.join(folder, f"frame_{frame_id}.jpg")
    with open(filename, "wb") as frame_file:
        frame_file.write(request.data)

    with state_lock:
        camera_frames.setdefault(session_id, [])
        camera_frames[session_id].append(filename)

    print(f"Saved camera frame: {os.path.abspath(filename)} | Size: {len(request.data)} bytes")
    return "FRAME_OK", 200

@app.route("/cam_done", methods=["POST"])
def cam_done():
    data = request.data.decode(errors="ignore").strip()
    parts = data.split("|")
    message = parts[0] if parts else ""
    session_id = parts[1] if len(parts) > 1 else ""
    user_id = request.args.get('user_id', 'default_user')
    device_id = request.args.get('device_id', 'esp32_01')

    print(f"ESP32-CAM done message: {data}")

    with state_lock:
        matches = pending_snapshot_session == session_id
        frames = list(camera_frames.get(session_id, []))

    if matches:
        if message == "snapshot_done":
            camera_done_event.set()
            # Process and upload frames to Supabase in a background thread to prevent ESP32 timeout
            threading.Thread(target=process_cam_frames_async, args=(session_id, frames, user_id, device_id)).start()
        elif message == "video_done":
            camera_done_event.set()
            # Process and compile frames to video, then upload to Supabase in a background thread
            threading.Thread(target=process_video_frames_async, args=(session_id, frames, user_id, device_id)).start()

    return "DONE_ACK", 200

def process_cam_frames_async(session_id, frames, user_id, device_id):
    try:
        mjpeg_path = save_mjpeg(session_id, frames)
        print(f"Saved MJPEG: {mjpeg_path}")

        # Process each captured frame, upload to Supabase, and analyze with Llama Vision
        for frame_path in sorted(frames):
            if not os.path.exists(frame_path):
                continue
            
            filename = f"{uuid.uuid4()}_{os.path.basename(frame_path)}"
            with open(frame_path, 'rb') as f:
                storage_path = f"{user_id}/{filename}"
                supabase.storage.from_('media').upload(storage_path, f.read())
            
            public_url = supabase.storage.from_('media').get_public_url(storage_path)

            media_data = {
                "user_id": user_id,
                "url": public_url,
                "type": "image",
                "device_id": device_id,
                "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
            }
            supabase.table('media_items').insert(media_data).execute()

            # Analyze image using Llama Vision in background
            def run_vision_analysis(p_url):
                try:
                    analysis = analyze_vision(p_url)
                    update_data = {
                        "ai_caption": analysis.get('caption', ''),
                        "ai_tags": analysis.get('tags', []),
                        "analysis": analysis
                    }
                    supabase.table('media_items').update(update_data).eq("url", p_url).execute()
                    print(f"Llama Vision analysis completed for: {p_url}")
                except Exception as ve:
                    print(f"Llama Vision error: {ve}")

            threading.Thread(target=run_vision_analysis, args=(public_url,)).start()

    except Exception as e:
        print(f"Error in process_cam_frames_async: {e}")

def process_video_frames_async(session_id, frames, user_id, device_id):
    try:
        sorted_frames = sorted(frames)
        if not sorted_frames:
            print("No frames received for video compilation.")
            return

        from moviepy.video.io.ImageSequenceClip import ImageSequenceClip
        
        output_video_dir = Path("uploads") / "converted"
        os.makedirs(output_video_dir, exist_ok=True)
        output_video_path = output_video_dir / f"video_{session_id}.mp4"
        
        print(f"Compiling video from {len(sorted_frames)} frames...")
        clip = ImageSequenceClip(sorted_frames, fps=5)
        clip.write_videofile(str(output_video_path), codec="libx264", logger=None)
        print(f"Stitched video saved: {output_video_path}")

        # Upload video to Supabase Storage
        filename = f"{uuid.uuid4()}_video_{session_id}.mp4"
        with open(output_video_path, 'rb') as f:
            storage_path = f"{user_id}/{filename}"
            supabase.storage.from_('media').upload(storage_path, f.read())
        
        public_url = supabase.storage.from_('media').get_public_url(storage_path)
        print(f"Uploaded video to Supabase: {public_url}")

        # Insert record to media_items table in Supabase
        media_data = {
            "user_id": user_id,
            "url": public_url,
            "type": "video",
            "device_id": device_id,
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "ai_caption": "SmartGlasses captured video snippet.",
            "ai_tags": ["video", "clip"]
        }
        supabase.table('media_items').insert(media_data).execute()
        print("Logged video media_item to database successfully.")

    except Exception as e:
        print(f"Error in process_video_frames_async: {e}")

@app.route("/last_snapshot_status", methods=["GET"])
def last_snapshot_status():
    with state_lock:
        session_id = pending_snapshot_session
        frames = list(camera_frames.get(session_id, [])) if session_id else []

    return f"session={session_id}\nframes={len(frames)}\n", 200

@app.route("/health", methods=["GET"])
def health():
    with state_lock:
        text = (
            f"is_recording={is_recording}\n"
            f"last_wav_path={last_wav_path}\n"
            f"last_recording_bytes={len(last_recording_pcm)}\n"
            f"cam_command={cam_command}\n"
            f"pending_snapshot_session={pending_snapshot_session}\n"
        )
    return text, 200

if __name__ == '__main__':
    os.makedirs("snapshots", exist_ok=True)
    app.run(host='0.0.0.0', port=5000, debug=True)
