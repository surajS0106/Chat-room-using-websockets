// import WebSocket, { WebSocketServer } from "ws";

// type RoomServer = {
//     roomId: string;
//     wss: WebSocketServer;
//     clients: Set<WebSocket>;
// };

// const rooms: RoomServer[] = [];

// /**
//  * Create a WebSocket server for a specific room
//  */
// function createRoom(roomId: string, port: number) {
//     const wss = new WebSocketServer({ port });
//     const clients = new Set<WebSocket>();

//     wss.on("connection", (ws) => {
//         clients.add(ws);
//         console.log(`Client connected to ${roomId}`);

//         ws.on("message", (msg) => {
//             console.log(`Message in ${roomId}: ${msg}`);
//             broadcast(clients, msg.toString());
//         });

//         ws.on("close", () => {
//             clients.delete(ws);
//             console.log(`Client left ${roomId}`);
//         });
//     });

//     rooms.push({ roomId, wss, clients });
//     console.log(`✅ Room '${roomId}' WebSocket running on ws://localhost:${port}`);
// }

// /**
//  * Send message to all clients in the same room
//  */
// function broadcast(clients: Set<WebSocket>, message: string) {
//     for (const client of clients) {
//         if (client.readyState === WebSocket.OPEN) {
//             client.send(message);
//         }
//     }
// }

// // Create separate WebSocket servers for each room
// createRoom("room1", 8080);
// createRoom("room2", 8081);


import { WebSocketServer, WebSocket } from "ws";
// Use CommonJS style import for ioredis to avoid TS constructable issues
import * as RedisLib from "ioredis";


const Redis = (RedisLib as any).default ?? RedisLib;

// ---- Config ----
const PORT = parseInt(process.env.PORT || "8080", 10);
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// ---- Redis (1 pub, 1 sub) ----
const pub = new Redis(REDIS_URL);
const sub = new Redis(REDIS_URL);

// ---- In-memory room -> Set<WebSocket> for THIS instance only ----
const localRooms: Map<string, Set<WebSocket>> = new Map();

// Subscribe once per room (memoized)
const subscribedRooms = new Set<string>();
async function ensureSubscribed(roomId: string) {
  if (subscribedRooms.has(roomId)) return;
  await sub.subscribe(roomChannel(roomId));
  subscribedRooms.add(roomId);
  console.log(`Subscribed to Redis channel for room: ${roomId}`);
}

function roomChannel(roomId: string) {
  return `room:${roomId}`;
}

// ---- Incoming Pub/Sub -> broadcast to local sockets in that room ----
sub.on("message", (channel: string, payload: string) => {
  try {
    const msg = JSON.parse(payload);
    const roomId = channel.replace(/^room:/, "");
    const clients = localRooms.get(roomId);
    if (!clients) return;

    const data = JSON.stringify(msg);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  } catch {
    // ignore malformed payloads
  }
});

// ---- WebSocket server ----
const wss = new WebSocketServer({ port: PORT }, () => {
  console.log(`✅ WS server listening on ws://localhost:${PORT}`);
});

// Optional heartbeat to clean up dead connections
interface HeartbeatWS extends WebSocket {
  isAlive?: boolean;
}

wss.on("connection", (ws: HeartbeatWS) => {
  ws.isAlive = true;

  let currentRoom: string | null = null;

  ws.on("pong", () => (ws.isAlive = true));

  ws.on("message", async (raw) => {
    let msg: any;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: "error", error: "Invalid JSON" }));
      return;
    }

    if (msg.type === "join") {
      const roomId = String(msg.room || msg.roomId || "");
      if (!roomId) {
        ws.send(JSON.stringify({ type: "error", error: "room is required" }));
        return;
      }

      if (currentRoom) {
        removeFromRoom(currentRoom, ws);
        await publishSystem(currentRoom, "left");
      }

      currentRoom = roomId;
      addToRoom(roomId, ws);
      await ensureSubscribed(roomId);

      ws.send(JSON.stringify({ type: "system", text: `Joined room ${roomId}` }));
      await publishSystem(roomId, "joined");
      return;
    }

    if (msg.type === "chat") {
      if (!currentRoom) {
        ws.send(JSON.stringify({ type: "error", error: "Join a room first" }));
        return;
      }
      const text = String(msg.text ?? msg.message ?? "");
      if (!text) return;

      await pub.publish(
        roomChannel(currentRoom),
        JSON.stringify({
          type: "chat",
          room: currentRoom,
          text,
          ts: Date.now(),
        })
      );
      return;
    }

    if (msg.type === "leave") {
      if (!currentRoom) return;
      const roomId = currentRoom;
      removeFromRoom(roomId, ws);
      currentRoom = null;
      await publishSystem(roomId, "left");
      return;
    }

    ws.send(JSON.stringify({ type: "error", error: "Unknown message type" }));
  });

  ws.on("close", async () => {
    if (currentRoom) {
      const roomId = currentRoom;
      removeFromRoom(roomId, ws);
      await publishSystem(roomId, "left");
    }
  });
});

// ---- Helpers ----
function addToRoom(roomId: string, ws: WebSocket) {
  if (!localRooms.has(roomId)) localRooms.set(roomId, new Set());
  localRooms.get(roomId)!.add(ws);
}

function removeFromRoom(roomId: string, ws: WebSocket) {
  const set = localRooms.get(roomId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) {
    localRooms.delete(roomId);
  }
}

async function publishSystem(roomId: string, action: "joined" | "left") {
  await pub.publish(
    roomChannel(roomId),
    JSON.stringify({
      type: "system",
      room: roomId,
      text: `A user ${action} room ${roomId}`,
      ts: Date.now(),
    })
  );
}

// ---- Heartbeat ----
const interval = setInterval(() => {
  wss.clients.forEach((client: any) => {
    if (client.isAlive === false) return client.terminate();
    client.isAlive = false;
    client.ping();
  });
}, 30000);

wss.on("close", () => clearInterval(interval));
