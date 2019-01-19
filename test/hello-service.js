const http = require('http');

const app = new http.Server();

app.on('request', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.write('{"hello": "world"}');
  res.end('\n');
});

app.listen(3000, () => console.log("Listening on 3000"));