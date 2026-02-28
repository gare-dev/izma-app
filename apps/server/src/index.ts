import { v4 as uuid } from "uuid";

const rooms = new Map();

Bun.serve({
    port: 3001,
    fetch(req, server) {

        if (new URL(req.url).pathname === "/ws/") {

            if (server.upgrade(req)) return;
        }

        return new Response("Not found", { status: 404 });
    },

    websocket: {
        open(ws: { data?: { id: string; roomId: string | null } }) {
            ws.data = {
                id: uuid(),
                roomId: null
            };
            console.log("Client connected:", ws.data?.id);
        },

        message(ws, message) {
            try {
                const data = JSON.parse(message.toString());
                console.log("Received:", data);
            } catch (err) {
                console.log("Invalid JSON");
            }
        },

        close(ws: { data?: { id: string; roomId: string | null } }) {
            console.log("Client disconnected:", ws.data?.id);
        }
    }
});

console.log("Server running on http://localhost:3001");