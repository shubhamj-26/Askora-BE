# Setup Guide: Socket.IO Real-Time Communication

## Overview

Socket.IO enables real-time, bidirectional communication between server and clients. Used for:
- Real-time question/response updates
- Live chat messaging
- Automatic UI synchronization

## Architecture

```
Browser Client ↔ Socket.IO Server ↔ All Connected Clients
         (websocket/polling)
         
Organization Rooms:
- org_{domain} (all org members)
- user_{id} (individual user)
- admin_{domain} (admin channel)
```

## Backend Setup (Already Configured)

### 1. Socket Server Initialization
**File**: `src/index.ts`

```typescript
import { createServer } from "http"
import { initSocket } from "./services/socketService"

const httpServer = createServer(app)
const io = initSocket(httpServer)

httpServer.listen(PORT, () => {
    console.log(`🔌 Socket.IO ready on port ${PORT}`)
})
```

### 2. Authentication Middleware
**File**: `src/services/socketService.ts`

Socket connections verified with JWT token:
```typescript
io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    const decoded = jwt.verify(token, getJwtSecret())
    socket.data.user = decoded
    next()
})
```

**CORS Configuration**:
```typescript
const io = new SocketServer(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5843",
        methods: ["GET", "POST"],
        credentials: true,
    },
})
```

### 3. Event Emitters

#### Questions Events
**File**: `src/controllers/questionController.ts`

```typescript
// When admin creates question:
if (ioInstance) {
    ioInstance.to(companyDbName).emit("question:new", { question })
}

// When admin updates question:
ioInstance.to(companyDbName).emit("question:updated", { question })

// When admin deletes question:
ioInstance.to(companyDbName).emit("question:deleted", { questionId: id })
```

#### Response Events  
**File**: `src/controllers/responseController.ts`

```typescript
// When user submits response:
ioInstance.to(companyDbName).emit("response:new", { questionId, response })

// When user edits response:
ioInstance.to(companyDbName).emit("response:updated", { questionId, responseId })
```

#### Chat Events
**File**: `src/controllers/chatController.ts`

```typescript
// Broadcast new message:
ioInstance.to(companyDbName).emit("chat:message", chatMessage)

// User marks messages as read:
ioInstance.to(companyDbName).emit("chat:read", { userId })
```

## Frontend Setup (Already Configured)

### 1. Socket Connection Service
**File**: `src/services/socket.ts`

```typescript
export const connectSocket = (token: string): Socket => {
    socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
    })
    
    socket.on('connect', () => console.log('Connected'))
    socket.on('connect_error', (err) => console.warn(err))
    
    return socket
}
```

### 2. Integration with Components

#### QuestionsPage.tsx
```typescript
import { getSocket } from '../../services/socket'

useEffect(() => {
    const socket = getSocket()
    if (!socket) return
    
    socket.on('question:new', loadData)
    socket.on('question:updated', loadData)
    socket.on('question:deleted', loadData)
    socket.on('response:new', loadData)
    
    return () => {
        socket.off('question:new', loadData)
        socket.off('question:updated', loadData)
        // ... clean up other listeners
    }
}, [loadData])
```

#### ChatPage.tsx
```typescript
socket.emit('chat:enter')

socket.on('chat:message', (msg) => {
    setMessages((prev) => [...prev, msg])
})

socket.on('chat:leave', () => {
    // User left room
})

return () => {
    socket.emit('chat:leave')
    socket.off('chat:message', onNewMessage)
}
```

### 3. Auth Integration
**File**: `src/context/AuthContext.tsx`

```typescript
// After successful login:
const setupRealtime = (token: string, userId: string) => {
    connectSocket(token)
    // Also init Beams...
}

// On logout:
const logout = async () => {
    disconnectSocket()
    storage.clear()
}
```

## Configuration

### Environment Variables

**Backend** (`.env`):
```env
# Defaults to localhost:5842 if not set
FRONTEND_URL=http://localhost:5173  # CORS origin
```

**Frontend** (`.env`):
```env
# Defaults to http://localhost:5842 if not set
VITE_SOCKET_URL=http://localhost:5842
```

### Development Setup

```bash
# Install dependencies
cd Askora-BE && npm install
cd Askora-FE && npm install

# Start backend
cd Askora-BE
npm run dev
# Should show: "🔌 Socket.IO ready"

# Start frontend (new terminal)
cd Askora-FE
npm run dev
```

## Testing

### 1. Connection Test
```javascript
// Browser Console (after login)
const socket = window.__socket
console.log(socket.connected)  // Should be true
console.log(socket.id)         // Should show socket ID
```

### 2. Event Test
```javascript
// Create question via API
// Check browser console for:
// "question:new received"

// Check multiple browser windows - all should update
```

### 3. Real-time Sync Test
1. Open app in 2 browser windows (logged in as different users)
2. Create a question in window 1
3. Window 2 should update automatically (no refresh needed)

### 4. Disconnect/Reconnect Test
```javascript
socket.disconnect()  // Manually disconnect
socket.connect()     // Reconnect
// Should see: "Socket reconnected" in console
```

## Architecture Deep Dive

### Event Flow

```
User Creates Question
        ↓
POST /questions
        ↓
[API Handler] Creates DB record
        ↓
[Socket Emitter] 
    io.to(companyDbName).emit("question:new", data)
        ↓
Connected Socket.IO Clients in room "companyDbName"
        ↓
[React Component Listener]
    socket.on("question:new", loadData)
        ↓
[Frontend State Update]
    setQuestions([...newQuestion, ...oldQuestions])
        ↓
[UI Rerender] with new question visible
```

### Rooms & Channels

```
Namespace: /
├── Room: companyDbName
│   └── All org members (auto-joined)
├── Room: user_{id}
│   └── Individual user subscriptions
└── Room: admin_{companyDbName}
    └── Admin-only notifications
```

### Reconnection Strategy

```
Connected
    ↓
[Network Loss]
    ↓
Attempt reconnect (delay: 1s)
    ↓
Success? 
├─ Yes → Re-authenticate with token → Subscribe to rooms
└─ No  → Retry up to 5 times, then stop
```

## Performance Optimization

### 1. Event Batching
Instead of emitting for each response:
```typescript
// ❌ Bad - many events
responses.forEach(r => emit("response:new", r))

// ✅ Good - single event
emit("response:batch", { responses })
```

### 2. Selective Listeners
Only listen to events you need:
```typescript
// ✅ Only QuestionsPage subscribes to question events
// ✅ Only ResponsesPage subscribes to response events
// ✅ Only ChatPage subscribes to chat events
```

### 3. Cleanup on Unmount
Always remove listeners to prevent memory leaks:
```typescript
return () => {
    socket?.off('question:new', handleData)
    socket?.off('question:updated', handleData)
}
```

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "Connected" not showing | Port blocked/CORS issue | Check FRONTEND_URL in .env |
| Events not received | Listener not attached | Check socket.on() in useEffect |
| Socket hangs on disconnect | Browser tab crash | Close tab, reopen |
| Multiple connections | Reconnect loop | Check token validity |
| Memory leak warning | Listeners not cleaned up | Add return () => socket.off() |

## Files Reference

**Backend**:
- `src/index.ts` - Socket initialization
- `src/services/socketService.ts` - Core socket config
- `src/controllers/questionController.ts` - Question events
- `src/controllers/responseController.ts` - Response events
- `src/controllers/chatController.ts` - Chat events

**Frontend**:
- `src/services/socket.ts` - Socket client setup
- `src/context/AuthContext.tsx` - Connection on auth
- `src/pages/dashboard/QuestionsPage.tsx` - Question listeners
- `src/pages/dashboard/ChatPage.tsx` - Chat listeners
- `src/pages/dashboard/ResponsesPage.tsx` - Response listeners

