const express = require('express')
const app = express()
const port = 3000

app.get('/json', (req, res) => res.json({ hello: 'world' }))

app.get('/text', (req, res) => res.send('<html>Hello World</html>'))

app.listen(port, () => console.log(`Example app listening on port ${port}!`))