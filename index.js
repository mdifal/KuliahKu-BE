const express = require('express');
const fs = require('firebase-admin');
const serviceAccount = require('./config/key.json');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const http = require('http');
const cors = require('cors');
const firebase = require("firebase/app");

fs.initializeApp({
  credential: fs.credential.cert(serviceAccount)
});

const app = express();
app.use(cors());
const server = http.createServer(app);
app.use(express.json());

const db = fs.firestore();

const secretKey = 'secret'; // Ganti dengan kunci rahasia yang lebih kuat dalam produksi

const allRoute = require('./routes/allRoute');
const collabPlan = require('./routes/collabPlan');

// Middleware
app.use(express.json());
const io = require('socket.io')(server);
const clients = {};

io.on("connection", (socket) => {
  console.log("connected");
  console.log(socket.id, "has joined");

  socket.on("signin", (id) => {
    console.log(id);
    clients[id] = socket;
    console.log(clients);
  });

  socket.on("chat", async (msg) => {
    console.log(msg);
    const { senderId, targetId, content, groupId, timestamp } = msg;

    if (groupId) {
      // Chat grup
      const groupChatRef = await db.collection('groups').doc(groupId).collection('chats').doc(timestamp).set({
        senderId,
        content,
        timestamp: new Date(timestamp)
      });
      
      // Emit pesan ke semua anggota grup
      const groupDoc = await db.collection('groups').doc(groupId).get();
      if (groupDoc.exists) {
        const groupData = groupDoc.data();
        const participants = groupData.participants;

        participants.forEach(participantId => {
          if (clients[participantId]) {
            clients[participantId].emit("message", {
              senderId,
              content,
              timestamp,
              groupId
            });
          }
        });
      }
    } else {
      // Chat pribadi
      let roomId;
      const senderRoomChatRef = db.collection('users').doc(senderId).collection('roomChats');
      const targetRoomChatRef = db.collection('users').doc(targetId).collection('roomChats');
      
      // Check if room chat already exists
      const senderRoomChats = await senderRoomChatRef.where('targetId', '==', targetId).limit(1).get();
      if (!senderRoomChats.empty) {
        roomId = senderRoomChats.docs[0].id;
      } else {
        // Create new room chat
        const newRoomRef = await db.collection('privateChats').add({
          participants: [senderId, targetId].sort(),
          createdAt: new Date()
        });
        roomId = newRoomRef.id;

        // Add roomId to users' roomChats
        await senderRoomChatRef.doc(roomId).set({ roomId, targetId });
        await targetRoomChatRef.doc(roomId).set({ roomId, targetId: senderId });
      }

      // Add message to room chat
      await db.collection('privateChats').doc(roomId).collection('messages').doc(timestamp).set({
        senderId,
        content,
        timestamp: new Date(timestamp)
      });

      // Emit message to sender and receiver
      if (clients[targetId]) {
        clients[targetId].emit("message", {
          senderId,
          content,
          timestamp,
          roomId
        });
      }

    }
  });

  socket.on("joinGroup", (groupId) => {
    socket.join(groupId);
  });

  socket.on("disconnect", () => {
    // Clean up when a client disconnects
    for (let id in clients) {
      if (clients[id] === socket) {
        delete clients[id];
        break;
      }
    }
    console.log(socket.id, "has left");
  });
});

app.use('/', allRoute);
app.use('/', collabPlan);

const port = process.env.PORT || 8080;
const host = '127.0.0.1';
server.listen(8000, '127.0.0.1', function() {
  server.close(function() {
    server.listen(8001, host);
    console.log(`Server sudah jalan`);
  });
});
