import { io } from "socket.io-client";
const socket = io('http://localhost:3000');
socket.on('connect', () => {
    console.log('connected');
    socket.emit('auth', { password: 'pratyush' });
});
socket.on('output', (data) => console.log('data:', data));
socket.on('disconnect', () => console.log('disconnected'));
socket.on('connect_error', (e) => console.log('err:', e));
