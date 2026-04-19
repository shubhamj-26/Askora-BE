# Setup Guide: Pusher Beams Push Notifications

## Step 1: Create Pusher Account

1. Go to **https://pusher.com**
2. Sign up or log in
3. Navigate to **Beams** (Channels or Beams product)
4. Create a new application

## Step 2: Get Your Credentials

After creating your application, you'll see:

### Instance ID
- Located in Beams → Settings → Instance ID
- Format: `XXXXXXXXXXXXXXXXXXXXXXX` (alphanumeric string)
- **Copy this value**

### Server Key
- Located in Beams → Settings → Server Key  
- Format: `Bearer XXXXXXXXXXXXXXXXXXXXXXX`
- **Copy this value** (without "Bearer " prefix)

### App ID, Key, Secret (for Channels events)
- Located in Channels → App Keys
- You'll get 4 values: App ID, Key, Secret, Cluster
- **Copy all values**

## Step 3: Configure Backend

Create/Edit `.env` file in `Askora-BE/`:

```env
# Pusher Beams (Push Notifications)
PUSHER_BEAMS_INSTANCE_ID=YOUR_INSTANCE_ID_HERE
PUSHER_BEAMS_SERVER_KEY=YOUR_SERVER_KEY_HERE

# Pusher Channels (Real-time events)
PUSHER_APP_ID=YOUR_APP_ID_HERE
PUSHER_KEY=YOUR_KEY_HERE
PUSHER_SECRET=YOUR_SECRET_HERE
PUSHER_CLUSTER=ap2
```

## Step 4: Configure Frontend

Create/Edit `.env` file in `Askora-FE/`:

```env
VITE_PUSHER_BEAMS_INSTANCE_ID=YOUR_INSTANCE_ID_HERE
```

## Step 5: Test the Setup

### Backend Test
```bash
cd Askora-BE
npm run dev
# Watch console for: "[Beams] Server ready"
```

### Frontend Test
```bash
cd Askora-FE
npm run dev
# Open browser console
# After login, should see: "🔔 Pusher Beams ready. Interests: [...]"
```

### Send Test Notification
1. Go to **Pusher Dashboard** → **Beams** → **Test Publish**
2. Target Interest: `org_yourdomain_com`
3. Add notification:
   ```json
   {
     "web": {
       "notification": {
         "title": "Test Notification",
         "body": "This is a test message!"
       }
     }
   }
   ```
4. Click **Publish**
5. Check if you receive OS notification in browser

## Step 6: Enable Browser Notifications

The app requests notification permission on first login. If denied:

1. **Chrome/Edge**: 
   - Click 🔒 icon in URL bar
   - Set Notifications to "Allow"
   - Reload page

2. **Firefox**:
   - Settings → Privacy → Notifications
   - Add `localhost:5173` to "Allow" list

3. **Safari** (macOS):
   - System Preferences → Notifications
   - Grant permission to browser

## Features Enabled

Once set up, you'll receive browser notifications for:

- ✅ **New Question Created** - Real-time org notification
- ✅ **New Response Submitted** - Real-time org notification  
- ✅ **New Chat Message** - Real-time org notification

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Instance ID not configured" warning | Check `.env` file has correct `VITE_PUSHER_BEAMS_INSTANCE_ID` |
| Notifications not received | Check browser notification permissions (Step 6) |
| Backend errors on startup | Verify all Pusher keys in `.env` are correct |
| Empty notification interest | User not in organization - check auth flow |

## Architecture

```
User Action
    ↓
Backend API (e.g., POST /questions)
    ↓
✓ Creates database record
✓ Broadcasts via Socket.IO (real-time for connected users)
✓ Triggers Pusher Beams (push notification for all org members)
✓ Emits Channels event (fallback real-time)
    ↓
Frontend receives notification
```

## Production Setup

For production deployment:

1. Update FRONTEND_URL in .env
```env
FRONTEND_URL=https://yourdomain.com
```

2. Update Pusher CORS settings (Pusher Dashboard)
3. Add domain to allowed origins
4. Use environment-specific keys/secrets

## API Reference

### Publish Notification (Backend)
```typescript
import { triggerPusherEvent } from "./config/pusher"

// When new question created:
await triggerPusherEvent(
  `org-${companyDbName}`,
  "question-new",
  { question, createdBy: email }
)
```

### Subscribe to Notifications (Frontend)
```typescript
// Automatically handled in AuthContext.tsx
// Users subscribed to interests after login
const { interests } = beamsRes.data.data
await initBeams({ instanceId, interests })
```

