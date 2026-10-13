import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { ApiError, decodeEnvelope, validateHello, validateResult } from './protocol.js';
export const SOCKET = '/var/lib/cheesecloth/control.sock';
export { ApiError };
function errorText(error) {
    return error instanceof Error ? error.message : String(error);
}
async function session(requests, cancellable) {
    const socket = GLib.getenv('CHEESECLOTH_SOCKET') || SOCKET;
    const client = new Gio.SocketClient();
    client.set_timeout(30);
    let connection = null;
    try {
        connection = await new Promise((resolve, reject) => {
            client.connect_async(Gio.UnixSocketAddress.new(socket), cancellable, (source, result) => {
                try {
                    resolve(source.connect_finish(result));
                }
                catch (error) {
                    reject(new ApiError('unreachable', `${socket}: ${errorText(error)}`));
                }
            });
        });
        const input = new Gio.DataInputStream({ base_stream: connection.get_input_stream() });
        const output = connection.get_output_stream();
        async function send(request) {
            const bytes = new TextEncoder().encode(`${JSON.stringify(request)}\n`);
            await new Promise((resolve, reject) => {
                output.write_all_async(bytes, GLib.PRIORITY_DEFAULT, cancellable, (source, result) => {
                    try {
                        source.write_all_finish(result);
                        resolve();
                    }
                    catch (error) {
                        reject(error);
                    }
                });
            });
            const line = await new Promise((resolve, reject) => {
                input.read_line_async(GLib.PRIORITY_DEFAULT, cancellable, (source, result) => {
                    try {
                        resolve(source.read_line_finish_utf8(result)[0]);
                    }
                    catch (error) {
                        reject(error);
                    }
                });
            });
            if (line === null)
                throw new ApiError('protocol', 'The daemon closed the connection.');
            let answer;
            try {
                answer = JSON.parse(line);
            }
            catch (error) {
                throw new ApiError('protocol', `Unexpected answer from the daemon: ${errorText(error)}`);
            }
            return decodeEnvelope(answer);
        }
        const hello = validateHello(await send({ cmd: 'hello' }));
        if (hello.api !== 1)
            throw new ApiError('version', `The daemon (cheesecloth ${hello.daemon}) speaks local API version ${hello.api}; this app speaks 1.`);
        const answers = [];
        for (const request of requests)
            answers.push(await send(request));
        return answers;
    }
    finally {
        connection?.close(null);
    }
}
export async function call(cmd, args = {}, cancellable = null) {
    return validateResult(cmd, (await session([{ cmd, ...args }], cancellable))[0]);
}
