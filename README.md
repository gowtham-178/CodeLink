# CodeLink

Real-time collaborative code editor. No login required — share a link and start coding together instantly.

## Features

- Live code sync via WebSocket (STOMP over SockJS)
- Multi-language syntax highlighting (Monaco Editor)
- Live chat panel per room
- Presence indicators and typing notifications
- Dark / light theme toggle
- Automatic idle-room cleanup

---

## Prerequisites

| Tool | Version |
|------|---------|
| Java | 21+ |
| Maven | 3.9+ (or use the included `mvnw` wrapper) |
| Node.js | 18+ |
| PostgreSQL | 14+ |

---

## 1. Database Setup

```sql
-- Connect to PostgreSQL as a superuser and run:
CREATE DATABASE codelink;
```

Default credentials assumed by `application.yml`:

| Property | Value |
|----------|-------|
| Host | `localhost:5432` |
| Database | `codelink` |
| Username | `postgres` |
| Password | `postgres` |

To use different credentials, edit `src/main/resources/application.yml`:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/codelink
    username: your_user
    password: your_password
```

Hibernate will create the `rooms` table automatically on first boot (`ddl-auto: update`).

---

## 2. Backend

```bash
# From the project root (d:\Projects\CodeLink)
mvnw.cmd spring-boot:run        # Windows
./mvnw spring-boot:run          # macOS / Linux
```

The backend starts on **http://localhost:8080**.

### Key configuration (`application.yml`)

```yaml
codelink:
  cors:
    # Comma-separated list of allowed frontend origins
    allowed-origins: http://localhost:5173

  room:
    # Empty room must be idle this long before reaper evicts it
    idle-timeout-minutes: 30
    # How often the reaper runs (milliseconds)
    reaper-interval-ms: 300000
    # Max chat messages kept in memory per room
    chat-history-limit: 200
```

---

## 3. Frontend

```bash
cd frontend
cp .env.example .env      # already pre-filled for local dev
npm install
npm run dev
```

The frontend starts on **http://localhost:5173**.

### Environment variables (`frontend/.env`)

```env
VITE_API_BASE_URL=http://localhost:8080
```

Change this to your backend URL for production deployments.

---

## 4. Using CodeLink

1. Open **http://localhost:5173**
2. Click **Create Room** — enter your name, a room name, and pick a language
3. Copy the invite link from the success screen and share it
4. Anyone opening the link enters a display name and joins instantly
5. Code, chat, and presence sync in real time across all participants

---

## Project Structure

```
CodeLink/
├── src/                          # Spring Boot backend
│   └── main/java/org/code/codelink/
│       ├── config/               # CORS + WebSocket STOMP config
│       ├── controller/           # REST: /api/rooms
│       ├── dto/                  # Request/response DTOs
│       ├── entity/               # JPA: Room
│       ├── exception/            # GlobalExceptionHandler
│       ├── model/                # In-memory: RoomRegistry, RoomSession, Participant
│       ├── repository/           # RoomRepository (JPA)
│       ├── service/              # RoomService, RoomReaperService
│       └── websocket/            # STOMP controllers + event payloads
├── frontend/                     # Vite + React frontend
│   └── src/
│       ├── components/           # Button, Input, Modal, Badge, Avatar, Editor panels
│       ├── contexts/             # RoomContext, ThemeContext
│       ├── pages/                # Landing, CreateRoom, JoinRoom, Room
│       └── services/             # roomApi.js (Axios), socketService.js (STOMP)
└── application.yml               # Backend configuration
```

---

## REST API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/rooms` | Create a room |
| `GET` | `/api/rooms/{roomId}` | Get room metadata |
| `GET` | `/api/rooms/{roomId}/users` | List active participants |

---

## WebSocket Events

**Endpoint:** `ws://localhost:8080/ws` (SockJS)

| Direction | Destination | Event |
|-----------|-------------|-------|
| Client → Server | `/app/room.join` | Join room |
| Client → Server | `/app/room.leave` | Leave room |
| Client → Server | `/app/room.code` | Code / language change |
| Client → Server | `/app/room.chat` | Chat message |
| Client → Server | `/app/room.typing` | Typing indicator |
| Server → Client | `/topic/room.{roomId}` | All room events |

All server events are wrapped in `{ type, roomId, payload }`.
