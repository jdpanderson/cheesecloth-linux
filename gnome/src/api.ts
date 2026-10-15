import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import type {Cancellable, SocketConnection} from 'gi://Gio';
import {ApiError, decodeEnvelope, validateHello, validateResult, type Results} from './protocol.js';
import type {Permissions} from './types.js';

export const SOCKET = '/var/lib/cheesecloth/control.sock';

export type {Cancellable};
export {ApiError};

interface Args {
    status: Record<string, never>;
    pending: Record<string, never>;
    peers: Record<string, never>;
    invite: {permissions: Permissions};
    init: {strict_security: boolean; ipv4_range?: string};
    join: {token: string};
    leave: {force: boolean};
    remove: {node: string};
    approve: {proposal: string};
    reject: {proposal: string};
}

function errorText(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

async function session(requests: Array<Record<string, unknown>>, cancellable: Cancellable | null): Promise<unknown[]> {
    const socket = GLib.getenv('CHEESECLOTH_SOCKET') || SOCKET;
    const client = new Gio.SocketClient();
    client.set_timeout(30);
    let connection: SocketConnection | null = null;
    try {
        connection = await new Promise<SocketConnection>((resolve, reject) => {
            client.connect_async(Gio.UnixSocketAddress.new(socket), cancellable,
                (source, result) => {
                    try {
                        resolve(source.connect_finish(result));
                    } catch (error) {
                        reject(new ApiError('unreachable', `${socket}: ${errorText(error)}`));
                    }
                });
        });
        const input = new Gio.DataInputStream({base_stream: connection.get_input_stream()});
        const output = connection.get_output_stream();
        async function send(request: Record<string, unknown>): Promise<unknown> {
            const bytes = new TextEncoder().encode(`${JSON.stringify(request)}\n`);
            await new Promise<void>((resolve, reject) => {
                output.write_all_async(bytes, GLib.PRIORITY_DEFAULT, cancellable,
                    (source, result) => {
                        try {
                            source.write_all_finish(result);
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    });
            });
            const line = await new Promise<string | null>((resolve, reject) => {
                input.read_line_async(GLib.PRIORITY_DEFAULT, cancellable,
                    (source, result) => {
                        try {
                            resolve(source.read_line_finish_utf8(result)[0]);
                        } catch (error) {
                            reject(error);
                        }
                    });
            });
            if (line === null)
                throw new ApiError('protocol', 'The daemon closed the connection.');
            let answer: unknown;
            try {
                answer = JSON.parse(line);
            } catch (error) {
                throw new ApiError('protocol', `Unexpected answer from the daemon: ${errorText(error)}`);
            }
            return decodeEnvelope(answer);
        }
        const hello = validateHello(await send({cmd: 'hello'}));
        if (hello.api !== 1)
            throw new ApiError('version', `The daemon (cheesecloth ${hello.daemon}) speaks local API version ${hello.api}; this app speaks 1.`);
        const answers: unknown[] = [];
        for (const request of requests)
            answers.push(await send(request));
        return answers;
    } finally {
        connection?.close(null);
    }
}

export async function call<C extends keyof Results>(
    cmd: C, args: Args[C] = {} as Args[C], cancellable: Cancellable | null = null,
): Promise<Results[C]> {
    return validateResult(cmd, (await session([{cmd, ...args}], cancellable))[0]);
}
