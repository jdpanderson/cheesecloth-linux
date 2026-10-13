import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {ApiError, call} from '../dist/api.js';

const status = await call('status');
if (status.phase !== 'member' || status.name !== 'test-node')
    throw new Error('The GJS client did not read the status reply.');

try {
    await call('pending');
    throw new Error('The malformed reply was accepted.');
} catch (error) {
    if (!(error instanceof ApiError) || error.kind !== 'protocol')
        throw error;
}

const cancellable = new Gio.Cancellable();
GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
    cancellable.cancel();
    return GLib.SOURCE_REMOVE;
});
try {
    await call('peers', {}, cancellable);
    throw new Error('The cancelled request completed.');
} catch (error) {
    if (!cancellable.is_cancelled())
        throw error;
}
