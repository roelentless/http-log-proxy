const http = require('http');
const httpProxy = require('http-proxy');
const { pick, isNumber } = require('lodash');
// const util = require('util');
const connect = require('connect');
const bodyParser = require('body-parser');
const streamBuffers = require('stream-buffers');
const contentType = require('content-type');
const reconnect = require('net-socket-reconnect');
const Stream = require('stream');
const fs = require('fs-extra');
const dfs = require('date-fns');
const path = require('path');

// Config
const port = parseInt(process.env.PORT) || 9000;

if (!process.env.TARGET || process.env.TARGET === '') {
  console.error(
    'You need to set env TARGET to the host, eg: https://api.your.com:123/path'
  );
  process.exit(1);
}

// Helpers
function debug(msg) {
  // We write to stderr to avoid being picked up by the stdout logger
  console.error(new Date().toISOString() + ' :: ' + msg);
}

function serializeBody(
  optionalBodyBuffer,
  requestType,
  decodeJSON,
  binaryBodyB64
) {
  let returnBody;
  if (optionalBodyBuffer) {
    switch (requestType) {
      case 'application/json':
        if (decodeJSON) {
          try {
            returnBody = JSON.parse(optionalBodyBuffer);
            break;
          } catch (e) {
            console.error('Could not decode body JSON', optionalBodyBuffer);
          }
        }
      case /text\/.*/.test(requestType):
      case 'application/xml':
        returnBody = optionalBodyBuffer.toString();
        break;
      default:
        if (binaryBodyB64) {
          returnBody = optionalBodyBuffer.toString('base64');
        }
    }
  }
  return returnBody;
}

function toLogRequest(req) {
  let type;
  try {
    type = contentType.parse(req).type;
  } catch (e) {}
  let body = serializeBody(
    req.body,
    type,
    process.env.REQ_DECODE_JSON === 'true',
    process.env.REQ_BINARY_BODY_B64 === 'true'
  );
  let l = {
    ...pick(req, ['headers', 'httpVersion', 'url', 'upgrade', 'method']),
    bodyLength: req.body ? req.body.byteLength : 0,
  };
  if (process.env.REQ_BODY !== 'false' && body && body !== '') {
    l = Object.assign(l, { body: body });
  }
  return l;
}

function toLogResponse(res) {
  let l = {
    ...pick(res, [
      'headers',
      'httpVersion',
      'statusCode',
      'statusMessage',
      'bodyLength',
    ]),
    bodyLength: res.rawBody ? res.rawBody.byteLength : 0,
  };
  let type;
  try {
    type = contentType.parse(res).type;
  } catch (e) {}
  let body = serializeBody(
    res.rawBody,
    type,
    process.env.RES_DECODE_JSON === 'true',
    process.env.RES_BINARY_BODY_B64 === 'true'
  );
  if (process.env.RES_BODY !== 'false' && body && body !== '') {
    l = Object.assign(l, {
      body: body,
    });
  }
  return l;
}

function logRequestWithResponse(req, res) {
  const logMsg = {
    '@timestamp': new Date().toISOString(),
    request: toLogRequest(req),
    response: toLogResponse(res),
  };
  output(logMsg);
}

function tcpOutputStream(host, port) {
  const client = reconnect({
    port: port,
    host: host,
    reconnectOnError: true,
    reconnectOnTimeout: true,
    reconnectOnEnd: true,
    reconnectInterval: 1000,
    reconnectTimes: 180,
  });
  client.on('reconnectFailed', err => {
    console.error(err);
    throw err;
  });
  client.on('error', err => {
    console.error(err);
  });
  return new Stream.Transform({
    objectMode: true,
    transform: function(chunk, enc, done) {
      client.write(chunk, () => done());
    },
  });
}

function rotatingFileoutputStream(filepath, rotateSizeMB, keepCount) {
  if (
    !filepath ||
    filepath === '' ||
    !isNumber(rotateSizeMB) ||
    !isNumber(keepCount)
  ) {
    throw new Error('Invalid file output config');
  }
  const parts = filepath.split('/');
  const dir = parts.slice(0, parts.length - 1).join('/');
  let err = fs.ensureDirSync(dir);
  if (err) {
    console.error(err);
    throw err;
  }
  let runningFiles = [];
  const fileMaxSize = Math.pow(2, 20) * rotateSizeMB;
  let runningSize = 0;
  let currentFileStream = null;
  return new Stream.Transform({
    objectMode: true,
    transform: function(chunk, enc, done) {
      if (!currentFileStream || runningSize >= fileMaxSize) {
        if (currentFileStream) {
          currentFileStream.end();
        }
        const nextFilePath = `${filepath}${dfs.format(
          new Date(),
          'YYYYMMDDHHmmssSSS'
        )}.log`;
        debug('opening new log file ' + nextFilePath);
        currentFileStream = fs.createWriteStream(nextFilePath);
        runningSize = 0;
        runningFiles.push(nextFilePath);
        while (runningFiles.length > keepCount) {
          const removableFile = runningFiles.shift();
          debug('removing old log file ' + removableFile);
          fs.unlink(removableFile, err => {
            if (err) {
              console.error(err);
              throw err;
            }
          });
        }
      }
      const buf = Buffer.from(chunk);
      currentFileStream.write(buf);
      runningSize += buf.byteLength;
      done();
    },
  });
}

let outputStream = process.stdout;
if (process.env.OUTPUT && process.env.OUTPUT !== '') {
  const parts = process.env.OUTPUT.split(':');
  if (parts[0] === 'stdout') {
    outputStream = process.stdout;
  } else if (parts[0] === 'stderr') {
    outputStream = process.stderr;
  } else if (parts[0] === 'tcp') {
    outputStream = tcpOutputStream(parts[1], parts[2]);
  } else if (parts[0] === 'file') {
    outputStream = rotatingFileoutputStream(
      parts[1],
      parseInt(parts[2]),
      parseInt(parts[3])
    );
  } else {
    throw new Error('Unknown OUTPUT format');
  }
}

function output(line) {
  line =
    process.env.PRETTY === 'true'
      ? JSON.stringify(line, null, 4)
      : JSON.stringify(line);
  outputStream.write(line + '\n');
}

// Proxy
const proxy = httpProxy.createProxyServer({
  changeOrigin: true,
  preserveHeaderKeyCase: true,
  autoRewrite: true,
  proxyTimeout: 300000,
  followRedirects: true,
});

proxy.on('error', function(e) {
  console.error(e);
});

if (process.env.DISABLE_LOG !== 'true') {
  proxy.on('proxyRes', function(proxyRes, req, res) {
    const d = [];
    proxyRes.on('data', c => d.push(c));
    proxyRes.on('end', () => {
      proxyRes.rawBody = Buffer.concat(d);
      logRequestWithResponse(req, proxyRes);
    });
  });
}

// HTTP server
var app = connect();

if (process.env.DISABLE_LOG !== 'true') {
  app.use(
    bodyParser.raw({ type: '*/*', limit: process.env.MAX_BODY_SIZE || '50mb' })
  );
}

app.use(function(req, res) {
  if (process.env.DISABLE_LOG !== 'true') {
    const bodyStream = new streamBuffers.ReadableStreamBuffer();
    bodyStream.put(req.body);
    proxy.web(req, res, {
      target: process.env.TARGET,
      buffer: bodyStream,
    });
  } else {
    debug('request processed');
    proxy.web(req, res, {
      target: process.env.TARGET,
    });
  }
});

const server = http.createServer(app);
server.listen(port, () => {
  debug(`Proxy service listening on 0.0.0.0:${port}`);
});

// Abort handler
function stop() {
  console.warn('Stopping...');
  proxy.close();
  server.close();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
