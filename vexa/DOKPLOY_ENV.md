# Amebo (Vexa) Dokploy Environment Variables

Here is the list of environment variables you need to set in **Dokploy** for the Vexa Lite or Vexa Docker-Compose deployment. 

Copy these exactly into your Dokploy environment settings and fill in the missing values (like your RunPod endpoint and Zoom keys if using Zoom).

```env
# 1. Base API Settings
ADMIN_API_TOKEN=your_secure_admin_token_here
LANGUAGE_DETECTION_SEGMENTS=10
VAD_FILTER_THRESHOLD=0.5
WHISPER_MODEL_SIZE=medium

# 2. Transcription Engine (Point this to your existing RunPod!)
DEVICE_TYPE=remote
REMOTE_TRANSCRIBER_URL=https://<YOUR_RUNPOD_ENDPOINT>/v1/audio/transcriptions
REMOTE_TRANSCRIBER_API_KEY=your_runpod_api_key
REMOTE_TRANSCRIBER_MODEL=whisper-v3-turbo

# 3. Database
# Dokploy likely spins up a local Postgres for you, or you can point this to an external one.
# Set REMOTE_DB=true if using an external Postgres
REMOTE_DB=false
DATABASE_URL=postgresql://user:pass@host/vexa

# 4. Storage (For saving the video/audio)
# If you want to save meeting recordings locally on the VPS disk:
STORAGE_BACKEND=local
LOCAL_STORAGE_DIR=/data/recordings

# 5. Zoom Integration (Required if you want Amebo to join Zoom)
# These come from your Zoom Marketplace App
# ZOOM_CLIENT_ID=
# ZOOM_CLIENT_SECRET=
```

### Next Steps:
1. Ensure your Hostinger KVM Dokploy instance has Docker privileges to run adjacent containers (Bots).
2. Push your localized NoteTaker/vexa folder to a brand new Github Repository.
3. In Dokploy, point the new Application to your GitHub Repository.
