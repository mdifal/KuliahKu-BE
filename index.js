const express = require('express');
const fs = require('firebase-admin');
const serviceAccount = require('./config/key.json');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const http = require('http')
const cors = require('cors');
const firebase = require("firebase/app");
fs.initializeApp({
 credential: fs.credential.cert(serviceAccount)
});


const app = express();
app.use(cors());
const server = http.createServer(app)
app.use(express.json());
const db = fs.firestore();

const secretKey = 'secret'; // Ganti dengan kunci rahasia yang lebih kuat dalam produksi



const allRoute = require('./routes/allRoute');

// Impor file-file kontroler jika diperlukan
// const authController = require('./controllers/authController');
// const userController = require('./controllers/userController');


var io = require("socket.io")(server);

//middlewre
app.use(express.json());
var clients = {};

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
    const { senderId, targetId, content, groupId } = msg;

    if (groupId) {
      // Chat grup
      const groupChatRef = await db.collection('groups').doc(groupId).collection('chats').add({
        senderId,
        content,
        timestamp: new Date()
      });
      io.to(groupId).emit("message", {
        senderId,
        content,
        timestamp: new Date(),
        groupId
      });
    } else {
      // Chat pribadi
      const privateChatRef = await db.collection('privateChats').add({
        participants: [senderId, targetId].sort(),
        senderId,
        content,
        timestamp: new Date()
      });
      if (clients[targetId]) {
        clients[targetId].emit("message", {
          senderId,
          content,
          timestamp: new Date()
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
});+
// Gunakan rute yang diimpor
app.use('/', allRoute);




  const port = process.env.PORT || 8080;
  const host = '127.0.0.1'
  server.listen(8000,'127.0.0.1',function(){
    server.close(function(){
      server.listen(8001, host)
      console.log(`Server sudah jalan`);
    })
   })


