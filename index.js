require('./init-env.js');
if (process.env.TS_RUN_MOCK === 'true') {
    require('./mock/mock-am.js');
}

const express = require('express');
const cookie = require('cookie');
const proxy = require('express-http-proxy');
const request = require('request');
const logger = require('pino')({
    level: process.env.TS_LOG_LEVEL,
    prettyPrint: process.env.TS_COLOR_LOGS === "true" ? {colorize: true} : false
});
const pinoHttp = require('pino-http');
const pinoSerializeReq = pinoHttp.stdSerializers.req;
const serializeRes = pinoHttp.stdSerializers.res;
const part2HeaderName = process.env.TS_TOKEN_SECOND_PART_HEADER;

const tokenEndpoint = process.env.TS_TOKEN_URI;

const app = express();
app.use(express.urlencoded({extended: false}));

app.post('/api/login', function (req, res) {
    const tokenRequest = {
        url: tokenEndpoint,
        form: req.body,
        auth: {
            user: process.env.TS_CLIENT_ID,
            pass: process.env.TS_CLIENT_SECRET,
        }
    };

    request.post(tokenRequest, function (idpErr, idpRes, idpBodyRaw) {
        if (idpErr) {
            sendLoginError(res, idpErr, this, idpRes, idpBodyRaw, "Error connecting to token endpoint");
        } else if (is2xx(idpRes)) {
            let idpBody = JSON.parse(idpBodyRaw);
            let token = idpBody["access_token"];
            const tokenParts = cutInHalf(token);
            logger.info("Token %s issued for", redact(token), tokenRequest.form.username);
            const maxAgeInMiliSec = idpBody["expires_in"] * 1000;
            res.cookie('first_half', tokenParts[0], {maxAge: maxAgeInMiliSec, httpOnly: true, path: '/api'});
            res.send({
                logged: true,
                second_half: tokenParts[1],

            });
        } else {
            sendLoginError(res, idpErr, this, idpRes, idpBodyRaw, "Error returned from token endpoint");
        }
    });
});

app.use('/api', proxy(process.env.TS_API_BACKEND_URI, {
    parseReqBody: false,
    proxyReqOptDecorator: function (proxyReqOpts, srcReq) {
        const cookieStr = srcReq.headers.cookie;
        let firstHalf = null;
        if (cookieStr) {
            const cookies = cookie.parse(cookieStr);
            firstHalf = cookies["first_half"];
            if (!firstHalf) {
                logger.warn(serializeReq(srcReq), "Api called with missing first_half cookie");
            }
        } else {
            logger.warn(serializeReq(srcReq), "Api called without cookies");
        }


        const second_half = srcReq.headers[part2HeaderName];
        if (!second_half) {
            logger.warn(serializeReq(srcReq), "Api called with missing header", part2HeaderName);
        }

        delete proxyReqOpts.headers[part2HeaderName];
        delete proxyReqOpts.headers.cookie;

        if (firstHalf && second_half) {
            let token = firstHalf + second_half;
            proxyReqOpts.headers['Authorization'] = 'Bearer ' + token;
            logger.debug("Api %s%s called with token", proxyReqOpts.host, proxyReqOpts.path, redact(token));
        }
        return proxyReqOpts;
    },
    proxyErrorHandler: function (err, res, next) {
        switch (err && err.code) {
            case 'ECONNRESET':
            case 'ECONNREFUSED': {
                logger.error(err, "Error connecting to api backend");
                return res.status(504).send({error: true});
            }
            default: {
                logger.error(err, "Error in during proxying the request.");
                return res.status(500).send({error: true});
            }
        }
    }
}));

function tryToParse(str) {
    try {
        return JSON.parse(str);
    } catch (ex) {
        return str;
    }
}

function is2xx(response) {
    return response.statusCode >= 200 && response.statusCode < 300;
}

function serializeReq(req) {
    const reqSafe = pinoSerializeReq(req);
    const headers = Object.assign({}, reqSafe.headers);
    reqSafe.headers = headers;
    headers.authorization = redact(headers.authorization);
    headers.cookie = redact(headers.cookie);
    headers[part2HeaderName] = redact(headers[part2HeaderName]);
    return reqSafe;
}


function cutInHalf(string) {
    const mid = string.length / 2;
    return [string.substr(0, mid), string.substr(mid)];
}


function sendLoginError(clientRes, err, req, res, body, msg) {
    let invocation = {
        req: serializeReq(req),
        body: tryToParse(body),
        uri: tokenEndpoint,
    };
    if (err) {
        invocation.err = err;
    } else {
        invocation.res = serializeRes(res);
    }
    logger.error(invocation, msg);
    clientRes.send({logged: false});
}

function redact(str) {
    return str && str.slice(0, 2) + "_..._" + str.slice(-2);
}

app.listen(process.env.TS_PORT);