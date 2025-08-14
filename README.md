Got it! Here’s a clean, professional **README** for your GitHub repo describing your scalable WebSocket chat backend with Redis. You can copy it as `README.md` in your project root:

---

````markdown
# Scalable WebSocket Chat Rooms

This project is a **scalable WebSocket chat server** built with **TypeScript**, **Node.js**, and **Redis**.  
It allows multiple chat rooms where messages are broadcasted only to users in the same room, and supports scaling across multiple backend instances using Redis Pub/Sub.

---

## Features

- Multiple chat rooms.
- Users only receive messages from the room they joined.
- Scalable backend: messages are synced across multiple server instances using Redis Pub/Sub.
- TypeScript for type safety and maintainable code.
- Optional heartbeat to detect dead WebSocket connections.

---

## Tech Stack

- **Node.js** (v22+)
- **TypeScript**
- **ws** — WebSocket server library
- **ioredis** — Redis client for Pub/Sub
- **Redis** — message broker for scaling multiple server instances

---

## Prerequisites

- **Node.js** >= 18
- **npm**
- **Redis** (local or Docker)

---

## Setup

1. **Clone the repository**

```bash
git clone <your-repo-url>
cd Chat-room-using-websockets
````

2. **Install dependencies**

```bash
npm install
```

3. **Start Redis**

**Option A: Using Docker**

```bash
docker run -p 6379:6379 redis:7
```

**Option B: Local Redis install**

Ensure Redis is running on `localhost:6379`.

4. **Run the server**

```bash
npm run dev
```

* The WebSocket server listens on **`ws://localhost:8080`** by default.
* You can change the port using the `PORT` environment variable:

```bash
PORT=8081 npm run dev
```

* Multiple instances can run on different ports; Redis ensures messages sync between them.

---

## Message Format

### Join a room

```json
{
  "type": "join",
  "room": "room1"
}
```

### Send chat message

```json
{
  "type": "chat",
  "text": "Hello everyone!"
}
```

### Leave a room

```json
{
  "type": "leave"
}
```

### System messages

* Automatically sent when a user joins or leaves a room:

```json
{
  "type": "system",
  "text": "A user joined room room1"
}
```

---

## Testing

* Use **Postman**, **Hopscotch**, or a simple HTML client to connect to the WebSocket server.
* Messages should only be received by users in the same room.
* Multiple backend instances synchronize messages via Redis Pub/Sub.

---

## Project Structure

```
Chat-room-using-websockets/
├─ src/
│  └─ server.ts         # WebSocket server code
├─ dist/                # Compiled JavaScript (tsc output)
├─ node_modules/
├─ package.json
└─ README.md
```

---

## Notes

* This backend is designed to scale horizontally using Redis. You can run multiple instances behind a load balancer, and room messages will sync automatically.
* WebSocket heartbeat is implemented to detect and terminate dead connections.

---
