const io = require('socket.io-client');

// Ganti URL dengan URL server kamu
const socket = io('http://localhost:8001');

// Listen for messages
socket.on('message', (data) => {
    console.log('Message from server:', data);
});

// Send a message once connected
socket.on('connect', () => {
    console.log('Connected to server');

    // Signin untuk mengidentifikasi pengguna
    socket.emit('signin', 'nisrinawafaz@gmail.com');

    // Join a group to listen for group messages
    socket.emit('joinGroup', 'IAT5TxunOVE7uSZrdalA'); // Ganti dengan ID grup yang sebenarnya

    // Mengirim pesan pribadi
    socket.emit('chat', {
        senderId: 'nisrinawafaz@gmail.com',
        targetId: 'rawr@email.com',
        content: 'Hello, this is a test message dari ninis!'
    });

    // Mengirim pesan grup
    socket.emit('chat', {
        senderId: 'nisrinawafaz@gmail.com',
        groupId: 'IAT5TxunOVE7uSZrdalA', // Ganti dengan ID grup yang sebenarnya
        content: 'Hello, this is a test message to the group dari ninis!'
    });
});

// Handle disconnection
socket.on('disconnect', () => {
    console.log('Disconnected from server');
});
