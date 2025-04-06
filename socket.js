const { Server } = require("socket.io");
const User = require("./models/User"); // ✅ Add this line

const onlineUsers = new Map(); // userId -> socketId

const setupSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*", // Change to frontend URL in prod
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;
    console.log("🟢 Client connected:", socket.id, "| User ID:", userId);

    if (userId) {
      onlineUsers.set(userId, socket.id);
      io.emit("userOnline", userId); // Broadcast to all users
    }

    socket.on("joinRoom", (roomId) => {
      socket.join(roomId);
      console.log(`👥 ${userId || socket.id} joined room: ${roomId}`);
    });

    socket.on("sendMessage", async (message) => {
      console.log("📩 Message received:", message);

      try {
        const user = await User.findById(message.sender);
        const messageWithName = {
          ...message,
          senderName: user?.name || "Unknown",
        };

        io.to(message.room).emit("message", messageWithName);
      } catch (err) {
        console.error("❌ Failed to fetch sender name:", err);
        io.to(message.room).emit("message", message); // fallback emit
      }
    });

    socket.on("leaveRoom", (roomId) => {
      socket.leave(roomId);
      console.log(`👋 ${userId || socket.id} left room: ${roomId}`);
    });

    socket.on("checkOnlineStatus", (targetUserId) => {
      const isOnline = onlineUsers.has(targetUserId);
      socket.emit(isOnline ? "userOnline" : "userOffline", targetUserId);
    });

    socket.on("disconnect", () => {
      console.log("🔴 Client disconnected:", socket.id);
      if (userId) {
        onlineUsers.delete(userId);
        io.emit("userOffline", userId); // Notify others
      }
    });
  });

  return io;
};

module.exports = setupSocket;
