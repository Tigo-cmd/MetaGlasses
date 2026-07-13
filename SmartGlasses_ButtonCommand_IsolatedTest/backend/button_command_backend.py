from datetime import datetime
import os
import struct
import threading
import time
import wave

from flask import Flask, Response, request

app = Flask(__name__)

SAMPLE_RATE = 16000
SAMPLE_WIDTH = 2
TARGET_PEAK = 28000

recording_data = bytearray()
is_recording = False
current_basename = None
last_recording_pcm = b""
last_wav_path = ""

cam_command = "idle"
pending_snapshot_session = None
camera_frames = {}
camera_done_event = threading.Event()

state_lock = threading.Lock()


@app.route("/", methods=["GET"])
def home():
    return "Smart Glasses isolated button command backend is running", 200


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


# ===================== ESP32-C3 AUDIO ROUTES =====================
@app.route("/start", methods=["POST"])
def start_recording():
    global recording_data, is_recording, current_basename

    with state_lock:
        recording_data = bytearray()
        is_recording = True
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        current_basename = f"button_command_recording_{timestamp}"

    print(f"\nRecording started: {current_basename}")
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
    global is_recording, last_recording_pcm, last_wav_path

    with state_lock:
        if not is_recording:
            return "NOT_RECORDING", 400

        is_recording = False
        basename = current_basename
        audio_bytes = bytes(recording_data)
        last_recording_pcm = normalize_pcm16(audio_bytes)

    raw_path = basename + ".raw"
    wav_path = basename + ".wav"

    with open(raw_path, "wb") as raw_file:
        raw_file.write(audio_bytes)

    with wave.open(wav_path, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(SAMPLE_WIDTH)
        wav_file.setframerate(SAMPLE_RATE)
        wav_file.writeframes(audio_bytes)

    with state_lock:
        last_wav_path = os.path.abspath(wav_path)

    duration = len(audio_bytes) / (SAMPLE_RATE * SAMPLE_WIDTH)
    print("\nRecording stopped.")
    print(f"Saved RAW: {os.path.abspath(raw_path)}")
    print(f"Saved WAV: {os.path.abspath(wav_path)}")
    print(f"Duration: {duration:.2f} seconds")

    return "SAVED", 200


@app.route("/prepare_playback", methods=["POST"])
def prepare_playback():
    with state_lock:
        has_audio = bool(last_recording_pcm)
        wav_path = last_wav_path

    if not has_audio:
        print("Playback requested, but no recording exists yet.")
        return "NO_RECORDING", 404

    print(f"Playback ready from: {wav_path}")
    return "PLAYBACK_READY", 200


@app.route("/last_recording_pcm", methods=["GET"])
def last_recording():
    with state_lock:
        pcm = last_recording_pcm

    if not pcm:
        return "NO_RECORDING", 404

    return Response(pcm, mimetype="application/octet-stream")


# ===================== CAMERA ROUTES =====================
@app.route("/snapshot2", methods=["POST"])
def snapshot2():
    global cam_command, pending_snapshot_session

    session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    camera_done_event.clear()

    with state_lock:
        pending_snapshot_session = session_id
        camera_frames[session_id] = []
        cam_command = f"snapshot2|{session_id}"

    print(f"Snapshot command queued: {cam_command}")
    return "SNAPSHOT_QUEUED", 200


@app.route("/cam_command", methods=["GET"])
def get_cam_command():
    global cam_command

    with state_lock:
        command = cam_command
        if cam_command != "idle":
            cam_command = "busy"

    if command == "busy":
        return "idle", 200

    if command != "idle":
        print(f"ESP32-CAM command delivered: {command}")

    return command, 200


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

    print(f"ESP32-CAM done message: {data}")

    with state_lock:
        matches = pending_snapshot_session == session_id
        frames = list(camera_frames.get(session_id, []))

    if message == "snapshot_done" and matches:
        mjpeg_path = save_mjpeg(session_id, frames)
        print(f"Saved MJPEG: {mjpeg_path}")
        camera_done_event.set()

    return "DONE_ACK", 200


@app.route("/last_snapshot_status", methods=["GET"])
def last_snapshot_status():
    with state_lock:
        session_id = pending_snapshot_session
        frames = list(camera_frames.get(session_id, [])) if session_id else []

    return f"session={session_id}\nframes={len(frames)}\n", 200


# ===================== HELPERS =====================
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


def clamp_int16(value):
    return max(-32768, min(32767, int(value)))


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


if __name__ == "__main__":
    os.makedirs("snapshots", exist_ok=True)
    app.run(host="0.0.0.0", port=5000, threaded=True)
