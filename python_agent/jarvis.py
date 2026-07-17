import os
import threading
import time
import tempfile
import webbrowser
import subprocess
import json
from pathlib import Path
from typing import Optional

import speech_recognition as sr
import pyttsx3
from flask import Flask, request, jsonify
from dotenv import load_dotenv

try:
    import openai
except Exception:
    openai = None

# Load environment
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / '.env')

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '').strip()
WAKE_WORD = os.getenv('WAKE_WORD', 'hey jarvis').lower()
AGENT_TOKEN = os.getenv('AGENT_TOKEN', 'change-this-token')
USE_OPENAI_WHISPER = os.getenv('USE_OPENAI_WHISPER', 'true').lower() in ('1', 'true', 'yes')
RECORD_AFTER_WAKE = int(os.getenv('RECORD_AFTER_WAKE', '6'))

if OPENAI_API_KEY and openai:
    openai.api_key = OPENAI_API_KEY

app = Flask(__name__)

# Simple allowlist for native actions
APP_MAP = {
    'notepad': ['notepad'],
    'calculator': ['calc'],
    'chrome': ['chrome', 'start', 'chrome.exe'],
}

# TTS engine (pyttsx3 is offline)
tts_engine = pyttsx3.init()
# lower volume/rate if desired
tts_engine.setProperty('rate', 160)

recognizer = sr.Recognizer()
mic = sr.Microphone()

listening_thread: Optional[threading.Thread] = None
stop_listening_flag = threading.Event()
awaiting_command = threading.Event()
last_command_holder = {'text': None}


def speak(text: str):
    print('[TTS]', text)
    try:
        tts_engine.say(text)
        tts_engine.runAndWait()
    except Exception as e:
        print('TTS error:', e)


def transcribe_with_openai(audio_path: str) -> str:
    if not OPENAI_API_KEY or openai is None:
        raise RuntimeError('OpenAI key not configured or openai package missing')
    print('Transcribing with OpenAI Whisper (upload)...')
    with open(audio_path, 'rb') as f:
        # Uses the v1 audio.transcriptions endpoint via openai
        result = openai.Audio.transcribe('whisper-1', f)
        # result is an object with 'text'
        text = result.get('text') if isinstance(result, dict) else getattr(result, 'text', '')
        return text or ''


def transcribe_with_google(audio: sr.AudioData) -> str:
    print('Transcribing with Google Speech (Recognizer)')
    try:
        return recognizer.recognize_google(audio)
    except sr.UnknownValueError:
        return ''
    except Exception as e:
        print('Google STT error:', e)
        return ''


def process_command(text: str):
    text = text.strip()
    if not text:
        return
    print('[Command]', text)
    lc = text.lower()

    # Built-in actions
    if lc.startswith('open ') and 'http' in lc:
        # open url
        url = text.split('open', 1)[1].strip()
        print('Opening URL:', url)
        webbrowser.open(url)
        speak(f'Opening {url}')
        return

    if lc.startswith('open ') or lc.startswith('launch '):
        # try open app from allowlist
        tokens = lc.split()
        # find a known app in tokens
        for name in APP_MAP:
            if name in tokens:
                cmd = APP_MAP[name]
                try:
                    print('Launching app:', name, cmd)
                    subprocess.Popen(cmd)
                    speak(f'Opening {name}')
                    return
                except Exception as e:
                    print('Failed to launch', name, e)
                    speak(f'Sorry, I could not open {name}')
                    return

    if lc.startswith('say '):
        to_say = text.split('say', 1)[1].strip()
        speak(to_say)
        return

    # If enabled, forward to OpenAI ChatCompletion for conversational reply
    if OPENAI_API_KEY and openai:
        try:
            messages = [
                { 'role': 'system', 'content': 'You are a helpful assistant named Jarvis.' },
                { 'role': 'user', 'content': text }
            ]
            print('Querying OpenAI chat...')
            resp = openai.ChatCompletion.create(model='gpt-3.5-turbo', messages=messages, max_tokens=256)
            reply = resp['choices'][0]['message']['content'].strip()
            print('AI reply:', reply)
            speak(reply)
            return
        except Exception as e:
            print('OpenAI chat error:', e)
            speak("Sorry, I couldn't reach the AI service.")
            return

    # Fallback
    speak("I'm not sure how to do that yet.")


def listener_loop():
    global awaiting_command
    print('Listener thread starting — calibrating ambient noise...')
    with mic as source:
        recognizer.adjust_for_ambient_noise(source, duration=1)
    print('Listening (press Ctrl+C to stop)')

    with mic as source:
        while not stop_listening_flag.is_set():
            try:
                audio = recognizer.listen(source, phrase_time_limit=8)
            except Exception as e:
                print('Microphone read error:', e)
                time.sleep(0.5)
                continue

            if USE_OPENAI_WHISPER and OPENAI_API_KEY:
                # write audio to temp WAV and upload
                try:
                    tmp = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
                    tmp.write(audio.get_wav_data())
                    tmp.flush()
                    tmp.close()
                    text = transcribe_with_openai(tmp.name)
                    os.unlink(tmp.name)
                except Exception as e:
                    print('OpenAI transcription failed:', e)
                    text = transcribe_with_google(audio)
            else:
                text = transcribe_with_google(audio)

            if not text:
                continue

            print('Heard:', text)
            lower = text.lower()

            if awaiting_command.is_set():
                awaiting_command.clear()
                # treat this audio as the command
                process_command(text)
                continue

            # Wake word detection (simple substring)
            if WAKE_WORD in lower:
                # remove wake word and see if there's more
                after = lower.replace(WAKE_WORD, '').strip()
                if after:
                    process_command(after)
                else:
                    # ask for the command and set awaiting flag
                    speak('Yes?')
                    awaiting_command.set()
                continue


@app.route('/status', methods=['GET'])
def status():
    token = request.headers.get('x-agent-token') or request.args.get('token')
    if not token or token != AGENT_TOKEN:
        return jsonify({ 'error': 'unauthorized' }), 401
    return jsonify({ 'status': 'ok', 'wake_word': WAKE_WORD })


@app.route('/command', methods=['POST'])
def api_command():
    token = request.headers.get('x-agent-token') or request.args.get('token')
    if not token or token != AGENT_TOKEN:
        return jsonify({ 'error': 'unauthorized' }), 401
    data = request.get_json() or {}
    action = data.get('action')
    args = data.get('args') or {}

    if not action:
        return jsonify({ 'error': 'action required' }), 400

    # manual record trigger
    if action == 'record':
        # set awaiting_command for the next phrase
        awaiting_command.set()
        return jsonify({ 'ok': True, 'message': 'ready for command' })

    # builtin actions
    if action == 'say':
        text = args.get('text', '')
        if not text:
            return jsonify({ 'error': 'text required' }), 400
        threading.Thread(target=speak, args=(text,)).start()
        return jsonify({ 'ok': True })

    if action == 'open_url':
        url = args.get('url')
        if not url:
            return jsonify({ 'error': 'url required' }), 400
        webbrowser.open(url)
        return jsonify({ 'ok': True })

    if action == 'open_app':
        app_name = (args.get('app') or '').lower()
        if not app_name:
            return jsonify({ 'error': 'app required' }), 400
        cmd = APP_MAP.get(app_name)
        if not cmd:
            return jsonify({ 'error': 'app not allowed' }), 403
        try:
            subprocess.Popen(cmd)
            return jsonify({ 'ok': True })
        except Exception as e:
            return jsonify({ 'error': str(e) }), 500

    return jsonify({ 'error': 'unknown action' }), 400


def start_flask():
    app.run(host='127.0.0.1', port=41234)


def main():
    global listening_thread
    print('Starting Jarvis (Python)')
    # start flask in a thread
    t = threading.Thread(target=start_flask, daemon=True)
    t.start()

    listening_thread = threading.Thread(target=listener_loop, daemon=True)
    listening_thread.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print('Shutting down...')
        stop_listening_flag.set()
        listening_thread.join(timeout=2)


if __name__ == '__main__':
    main()
