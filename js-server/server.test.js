import test from 'node:test';
import assert from 'node:assert';
import http from 'http';
import { server } from './server.js';

test('js-server returns 404 for unknown endpoints', (t, done) => {
    server.listen(0, () => {
        const port = server.address().port;
        const req = http.request({
            hostname: 'localhost',
            port: port,
            path: '/unknown',
            method: 'GET'
        }, (res) => {
            assert.strictEqual(res.statusCode, 404);
            res.on('data', () => {});
            res.on('end', () => {
                server.close(done);
            });
        });
        req.end();
    });
});

test('js-server returns CORS headers', (t, done) => {
    server.listen(0, () => {
        const port = server.address().port;
        const req = http.request({
            hostname: 'localhost',
            port: port,
            path: '/v1/chat/completions',
            method: 'OPTIONS'
        }, (res) => {
            assert.strictEqual(res.statusCode, 204);
            assert.strictEqual(res.headers['access-control-allow-origin'], '*');
            res.on('data', () => {});
            res.on('end', () => {
                server.close(done);
            });
        });
        req.end();
    });
});
