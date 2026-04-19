# Token Management & Real-Time Integration Guide

## JWT Token Implementation

### Overview
The application uses a **dual-token system** for secure authentication:
- **Access Token**: Short-lived (15 minutes) for API requests
- **Refresh Token**: Long-lived (7 days) for obtaining new access tokens

### Token Storage
Tokens are stored in `localStorage`:
```javascript
// Frontend storage
localStorage.setItem('askora_access_token', token)
localStorage.setItem('askora_refresh_token', refreshToken)
```

### How Tokens Work

#### 1. **Login/Signup Flow**
```
User submits credentials → Backend validates → 
Issues accessToken + refreshToken → Client stores both tokens
```

#### 2. **API Request Flow**
Every API request automatically includes the access token:
```javascript
// Axios interceptor automatically adds: 
Authorization: Bearer {accessToken}
```

#### 3. **Token Expiration Handling**
When access token expires (401 response):
```
1. Axios interceptor catches 401 error
2. Automatically sends refresh token to POST /api/auth/refresh
3. Receives new access token
4. Retries original request with new token
5. If refresh also fails → User returned to login
```

### Testing JWT Tokens

#### Test 1: Access Token Validation
```bash
# Get access token from browser localStorage
TOKEN=$(grep -o '"askora_access_token":"[^"]*' ~/.local/share/... | cut -d'"' -f4)

# Test API request with token
curl -H "Authorization: Bearer $TOKEN" http://localhost:5842/api/auth/me

# Expected response: 200 with user data
```

#### Test 2: Refresh Token Flow
```bash
# Test refresh endpoint
curl -X POST http://localhost:5842/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken": "YOUR_REFRESH_TOKEN"}'

# Expected response: 200 with new accessToken and refreshToken
```

#### Test 3: Token Expiration
```bash
# Modify JWT_EXPIRES_IN in authController.ts to "1s" for testing
# Sign up/login → wait 2 seconds → make API request
# Expect: Automatic token refresh happens silently
```

#### Test 4: Invalid Token
```bash
# Use expired/invalid token
curl -H "Authorization: Bearer invalid.token.here" \
  http://localhost:5842/api/auth/me

# Expected: 401 Unauthorized
# Frontend will redirect to login
```

### Token Configuration

**Backend** (`src/controllers/authController.ts`):
```typescript
const JWT_EXPIRES_IN = "15m"          // Access token duration
const REFRESH_EXPIRES_IN = "7d"       // Refresh token duration
```

**Environment Variables** (`.env`):
```env
JWT_SECRET=your_secret_key_here
JWT_REFRESH_SECRET=your_refresh_secret_here
```

### Frontend Token Usage

The `storage` helper manages tokens:
```javascript
// Get token
const token = storage.getAccessToken()

// Set tokens
storage.setTokens(accessToken, refreshToken)

// Clear tokens (logout)
storage.clear()

// Get user data
const user = storage.getUser()
```

---

## Socket.IO Real-Time Communication

### Setup

#### Backend Configuration
Already configured in `src/index.ts`:
```typescript
const io = initSocket(httpServer)
setQuestionSocketIo(io)
setResponseSocketIo(io)
setChatSocketIo(io)
```

#### Frontend Configuration
Socket is initialized in `src/services/socket.ts`:
```typescript
connectSocket(token)  // Called after login
getSocket()          // Get socket instance
```

### Events

#### Questions (Real-time sync)
```javascript
// When question is created
socket.on('question:new', (data) => { /* reload */ })

// When question is updated
socket.on('question:updated', (data) => { /* reload */ })

// When question is deleted
socket.on('question:deleted', (data) => { /* reload */ })
```

**Frontend Usage** (QuestionsPage.tsx):
```javascript
const socket = getSocket()
socket.on('question:new', loadData)
socket.on('question:updated', loadData)
return () => {
    socket.off('question:new', loadData)
    socket.off('question:updated', loadData)
}
```

#### Responses (Real-time sync)
```javascript
socket.on('response:new', (data) => { /* increment count */ })
socket.on('response:updated', (data) => { /* refresh */ })
```

#### Chat (Real-time messaging)
```javascript
// Join chat room
socket.emit('chat:enter')

// Receive message
socket.on('chat:message', (msg) => { /* add to list */ })

// Leave chat room
socket.emit('chat:leave')
```

**Usage** (ChatPage.tsx):
```javascript
socket.emit('chat:enter')
socket.on('chat:message', onNewMessage)
return () => {
    socket.off('chat:message', onNewMessage)
    socket.emit('chat:leave')
}
```

### Testing Socket.IO

#### Test 1: Basic Connection
```javascript
// In browser console while logged in:
const socket = io('http://localhost:5842')
console.log('Socket ID:', socket.id)
console.log('Connected:', socket.connected)
```

#### Test 2: Listen to Events
```javascript
socket.on('question:new', (data) => {
    console.log('New question:', data)
})
```

#### Test 3: Emit Events (from API)
When you create a question via API, check browser console for the event.

---

## Pusher Beams Push Notifications

### Setup

#### 1. Create Pusher Beams Account
- Go to https://pusher.com/beams
- Create new application
- Get your **Instance ID** and **Server Key**

#### 2. Add to `.env` Files

**Backend** (`.env`):
```env
PUSHER_BEAMS_INSTANCE_ID=your_instance_id
PUSHER_BEAMS_SERVER_KEY=your_server_key
```

**Frontend** (`.env`):
```env
VITE_PUSHER_BEAMS_INSTANCE_ID=your_instance_id
```

#### 3. Backend Configuration
Already configured in `src/config/pusher.ts`:
```typescript
const beamsClient = new PushNotifications({
    instanceId: process.env.PUSHER_BEAMS_INSTANCE_ID,
    secretKey: process.env.PUSHER_BEAMS_SERVER_KEY,
})
```

#### 4. Frontend Registration
Already configured in `src/services/beams.ts`:
```typescript
export const initBeams = async (config: unknown) => {
    const PushNotifications = (window as any).PushNotifications
    await PushNotifications.start(config)
}
```

### API Endpoints

#### Get Beams Auth
```bash
curl -H "Authorization: Bearer {token}" \
  http://localhost:5842/api/beams/auth

# Response:
{
  "beamsUserId": "user_12345",
  "interests": ["org_gmail_com"]
}
```

#### Publish Notification
```bash
curl -X POST https://api.pusher.com/publish/v1/instances/{instance_id}/notifications \
  -H "Authorization: Bearer {server_key}" \
  -H "Content-Type: application/json" \
  -d '{
    "interests": ["org_domain"],
    "web": {
      "notification": {
        "title": "New Question",
        "body": "A new question has been posted",
        "icon": "/icon.png"
      }
    }
  }'
```

### Integration Points

Notifications are sent when:
- **New Question Created**: Posts to org-specific interest
- **New Response Submitted**: Posts to org-specific interest
- **New Chat Message**: Posts to org-specific interest

**Backend Example** (`src/controllers/questionController.ts`):
```typescript
await triggerPusherEvent(`org-${companyDbName}`, "question-new", { question })
```

**Frontend Usage** (AuthContext.tsx):
```typescript
const beamsRes = await beamsApi.getAuth()
const { interests } = beamsRes.data.data
await initBeams({
    instanceId: import.meta.env.VITE_PUSHER_BEAMS_INSTANCE_ID,
    interests,
})
```

### Testing Beams

#### Test 1: Check Browser Console
```javascript
// After login, check for:
"Beams setup skipped: {userId}" OR successful init
```

#### Test 2: Send Test Notification
Use Pusher Dashboard → Test Publish
Target interest: `org_yourdomain_com`

#### Test 3: Create Real Event
1. Create a question via API
2. Check browser notifications
3. Should receive OS notification

### Debugging

#### Beams not initializing?
1. Check `VITE_PUSHER_BEAMS_INSTANCE_ID` in `.env`
2. Check browser console for errors
3. Check network tab for `/api/beams/auth` response

#### Notifications not received?
1. Verify Pusher dashboard shows published notifications
2. Check browser notification permissions
3. Verify correct interests are subscribed

---

## Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| 401 Unauthorized on requests | Access token expired; browser should auto-refresh |
| Socket events not received | Check `connectSocket(token)` called after login |
| Push notifications blocked | Check browser notification permissions |
| CORS errors | Verify `allowedOrigins` in `src/index.ts` includes frontend URL |

---

## File References

- **Auth**: `src/controllers/authController.ts`
- **Socket.IO**: `src/services/socketService.ts`, `src/services/socket.ts`
- **Pusher**: `src/config/pusher.ts`, `src/services/beams.ts`
- **Storage**: `src/services/api.ts` (storage helper)
- **Auth Context**: `src/context/AuthContext.tsx`

