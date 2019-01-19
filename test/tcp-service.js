var net = require('net');

var server = net.createServer(function(socket) {
  socket.on('data', data => {
    console.log(data.toString());
  });
});

server.listen(3001);