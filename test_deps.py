import sys
try:
    import fastapi
    print("fastapi: OK")
except ImportError:
    print("fastapi: MISSING")

try:
    import uvicorn
    print("uvicorn: OK")
except ImportError:
    print("uvicorn: MISSING")

try:
    import faster_whisper
    print("faster_whisper: OK")
except ImportError:
    print("faster_whisper: MISSING")

try:
    import pyannote.audio
    print("pyannote.audio: OK")
except ImportError:
    print("pyannote.audio: MISSING")

try:
    import llama_cpp
    print("llama_cpp: OK")
except ImportError:
    print("llama_cpp: MISSING")
