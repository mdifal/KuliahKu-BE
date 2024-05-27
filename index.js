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
  console.log("connetetd");
  console.log(socket.id, "has joined");
  socket.on("signin", (id) => {
    console.log(id);
    clients[id] = socket;
    console.log(clients);
  });
  socket.on("message", (msg) => {
    console.log(msg);
    let targetId = msg.targetId;
    if (clients[targetId]) clients[targetId].emit("message", msg);
  });
});

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


