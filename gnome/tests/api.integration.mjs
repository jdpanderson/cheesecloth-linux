import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {mkdtemp, mkdir, rm} from 'node:fs/promises';
import {join, resolve} from 'node:path';
import test from 'node:test';

const status = {
    phase: 'member', name: 'test-node', node_id: 'a'.repeat(64),
    cluster_id: 'b'.repeat(64), members: 1, warnings: [], public: false,
    relay: false, ipv4: '100.80.11.5', ipv6: null, keepalive: 25,
    changes_paused: false, version: 1, acceptors: ['a'.repeat(64)],
    config: 1, security: 'relaxed', quorum: 1, reachable_voters: 1,
    strict_security: false, buffer_nodes: 0, wg_backend: 'kernel',
    wg_interface: 'wg0', wg_port: 51820, control_addr: null,
    port_mapping: null,
};

test('GJS exchanges requests with a daemon and cancels a pending reply', async () => {
    const target = resolve('..', 'target');
    await mkdir(target, {recursive: true});
    const directory = await mkdtemp(join(target, 'gnome-api-'));
    const socketPath = join(directory, 'control.sock');
    const server = createServer(socket => {
        let pending = '';
        socket.on('data', chunk => {
            pending += chunk.toString();
            while (pending.includes('\n')) {
                const newline = pending.indexOf('\n');
                const request = JSON.parse(pending.slice(0, newline));
                pending = pending.slice(newline + 1);
                if (request.cmd === 'hello')
                    socket.write(JSON.stringify({ok: {api: 1, daemon: '0.5.0'}}) + '\n');
                else if (request.cmd === 'status')
                    socket.write(JSON.stringify({ok: status}) + '\n');
                else if (request.cmd === 'pending')
                    socket.write(JSON.stringify({ok: [{kind: 'join'}]}) + '\n');
            }
        });
    });
    try {
        server.listen(socketPath);
        await once(server, 'listening');
        const child = spawn('gjs', ['-m', 'tests/api.gjs.mjs'], {
            cwd: resolve('.'),
            env: {...process.env, CHEESECLOTH_SOCKET: socketPath},
        });
        let output = '';
        child.stdout.on('data', chunk => output += chunk.toString());
        child.stderr.on('data', chunk => output += chunk.toString());
        const timeout = setTimeout(() => child.kill(), 10000);
        const [code] = await once(child, 'close');
        clearTimeout(timeout);
        assert.equal(code, 0, output);
    } finally {
        server.close();
        await rm(directory, {recursive: true, force: true});
    }
});
