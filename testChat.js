const io = require('socket.io-client');

const socket1 = io('http://localhost:8001');
const socket2 = io('http://localhost:8001');
const socket3 = io('http://localhost:8001');

socket1.on('connect', () => {
  console.log('User 1 connected');
  socket1.emit('signin', 'rawr@email.com');
  
  socket1.on('message', (data) => {
    console.log('User 1 received:', data);
  });

//   socket1.emit('chat', {
//     senderId: 'rawr@email.com',
//     targetId: 'nisrinawafaz@gmail.com',
//     content: 'Hello Nisrina!'
//   });
});

socket2.on('connect', () => {
  console.log('User 2 connected');
  socket2.emit('signin', 'nisrinawafaz@gmail.com');
  
  socket2.on('message', (data) => {
    console.log('User 2 received:', data);
  });

  // Mengirim pesan pribadi dari User 2 ke User 1
  socket2.emit('chat', {
    senderId: 'nisrinawafaz@gmail.com',
    targetId: 'contoh@email.com',
    content: 'Hello User 1!'
  });
});

socket3.on('connect', () => {
    console.log('User 3 connected');
    socket3.emit('signin', 'contoh@email.com');
    
    socket3.on('message', (data) => {
      console.log('User 3 received:', data);
    });
  
    // Mengirim pesan pribadi dari User 2 ke User 1
    // socket3.emit('chat', {
    //   senderId: 'contoh@email.com',
    //   groupId: 'uCJPfn21rzZMUqUGZZ3z',
    //   content: 'Hello User Group!'
    // });

    
  });