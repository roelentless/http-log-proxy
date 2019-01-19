# http-log-proxy
Simple proxy service which logs requests/responses as clean json.   

-  Useful for intercepting traffic and debug requests if you can remap the DNS
-  Service tries to leave original requests & responses unchanged
-  Supports HTTP/HTTPS target endpoints
-  Clean logging for text, json and binary content
-  Performance: does around 1000 small-request/s on a 2,8 GHz Intel Core i5 2015 single thread, peaks at 75MB ram

### Usage
```
docker run --rm -it -p 9000:9000 -e TARGET="https://ifconfig.co" roelb/http-log-proxy
```
or
```
npm install
TARGET="https://ifconfig.co" node proxy.js
```

You can now send requests to 127.0.0.1:9000 and see request/response log output.

#### Example output for `curl 127.0.0.1:9000` with PRETTY=true:
````
{
    "@timestamp": "2019-01-19T12:09:06.221Z",
    "request": {
        "headers": {
            "host": "127.0.0.1:9000",
            "user-agent": "curl/7.54.0",
            "accept": "*/*"
        },
        "httpVersion": "1.1",
        "url": "/",
        "upgrade": false,
        "method": "GET"
    },
    "response": {
        "headers": {
            "date": "Sat, 19 Jan 2019 12:09:06 GMT",
            "content-type": "text/plain; charset=utf-8",
            "content-length": "15",
            "connection": "close",
            "set-cookie": [
                "__cfduid=d1058c17750df36c40438e536d96e49e2831547899746; expires=Sun, 19-Jan-20 12:09:06 GMT; path=/; domain=.ifconfig.co; HttpOnly"
            ],
            "via": "1.1 vegur",
            "expect-ct": "max-age=604800, report-uri=\"https://report-uri.cloudflare.com/cdn-cgi/beacon/expect-ct\"",
            "server": "cloudflare",
            "cf-ray": "49b930c5df7d0dbf4d-AMS"
        },
        "httpVersion": "1.1",
        "statusCode": 200,
        "statusMessage": "OK"
    }
}
````

### Configuration

#### Service config variables
| Variable               | Possible value                                                                    | 
|------------------------|-----------------------------------------------------------------------------------|
| TARGET                 | Set to URL you want to forward requests to. HTTP or HTTPS. Required.              |
| PORT                   | Port for the service to listen on. Default: `9000`                                |
| MAX_BODY_SIZE          | Max body size. Default: `50mb`                                                    |
| DISABLE_LOG            | Disable logging to leverage proxy capabilities only.                              | 
| OUTPUT                 | Output channel to write json to. Default: `stdout`.                               |

#### Possible OUTPUT configs
| Output                 | Possible value                                                                    | 
|------------------------|-----------------------------------------------------------------------------------|
| `stdout`               | Write new lines to process.stdout                                                 |
| `stderr`               | Write new lines to process.stderr                                                 |
| `tcp:host:port`        | Write new lines to TCP service. Reconnects automatically. Can drop messages when connection is failing. |
| `file:filepath:50:5`   | Write new lines to filepath pattern and rotate files every 50mb while keeping last 5 files.   Files are written with `YYYYMMDDHHmmssSSS.log` appended to them. Use `/` separator.  Example for filepath `/tmp/servicelogs-`: `/tmp/servicelogs-20190119143000000.log`  

#### Logging output styling
| Variable                    | Possible value                                                                                                | 
|------------------------     |---------------------------------------------------------------------------------------------------------------|
| PRETTY                      | Set to `true` for pretty console output. Default: `false` (one line for every request)                        |
| REQ_BODY                    | Set to `false` to disable request body logging. Default: `true`                                               |
| RES_BODY                    | Set to `false` to disable response body logging. Default: `true`                                              |
| REQ_DECODE_JSON             | Set to `true` to decode json body in the log. Default: `false`                                                |
| RES_DECODE_JSON             | Set to `true` to decode json body in the log. Default: `false`                                                |
| REQ_BINARY_BODY_B64         | Set to `true` to encode request binary content to base64. Default: `false` (false: body not logged)           |
| RES_BINARY_BODY_B64         | Set to `true` to encode response binary content to base64. Default: `false` (false: body not logged)          | 

### Dependencies
-  This service leverages [node-http-proxy](https://github.com/nodejitsu/node-http-proxy) under the hood.

### License

>The MIT License (MIT)
>
>Copyright (c) 2019 Roel Berger & the Contributors.
>
>Permission is hereby granted, free of charge, to any person obtaining a copy
>of this software and associated documentation files (the "Software"), to deal
>in the Software without restriction, including without limitation the rights
>to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
>copies of the Software, and to permit persons to whom the Software is
>furnished to do so, subject to the following conditions:
>
>The above copyright notice and this permission notice shall be included in
>all copies or substantial portions of the Software.
>
>THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
>IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
>FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
>AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
>LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
>OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
>THE SOFTWARE.