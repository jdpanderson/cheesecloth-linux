import Gio from 'gi://Gio';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import { ApiError, call } from './api.js';
import { errorState, menuState } from './display.js';
const ACTIONS = {
    status: 'Status…',
    peers: 'Peers…',
    approvals: 'Approvals…',
    create: 'Create Network…',
    join: 'Join Network…',
    cancel: 'Cancel Join…',
    retry: 'Retry Leave…',
    logs: 'Open Logs…',
};
export default class CheeseclothExtension extends Extension {
    _indicator = null;
    _cancellable = null;
    enable() {
        this._indicator = new PanelMenu.Button(0.0, 'Cheesecloth');
        this._indicator.add_child(new St.Icon({
            icon_name: 'network-vpn-symbolic',
            style_class: 'system-status-icon',
        }));
        this._indicator.menu.connect('open-state-changed', (_menu, open) => {
            if (open)
                this._refresh();
            else
                this._cancellable?.cancel();
        });
        Main.panel.addToStatusArea(this.uuid, this._indicator);
        this._render({ title: 'Starting…', detail: '', level: 'off', actions: [] });
    }
    disable() {
        this._cancellable?.cancel();
        this._indicator?.destroy();
        this._indicator = null;
    }
    async _refresh() {
        if (!this._indicator)
            return;
        this._cancellable?.cancel();
        const cancellable = new Gio.Cancellable();
        this._cancellable = cancellable;
        try {
            const status = await call('status', {}, cancellable);
            const proposals = status.phase === 'member'
                ? await call('pending', {}, cancellable) : [];
            if (!cancellable.is_cancelled())
                this._render(menuState(status, proposals));
        }
        catch (error) {
            if (!cancellable.is_cancelled())
                this._render(errorState(error instanceof ApiError ? error :
                    { message: error instanceof Error ? error.message : String(error) }));
        }
        finally {
            if (this._cancellable === cancellable)
                this._cancellable = null;
        }
    }
    _render(state) {
        if (!this._indicator)
            return;
        const menu = this._indicator.menu;
        menu.removeAll();
        menu.addMenuItem(new PopupMenu.PopupMenuItem('Cheesecloth', { reactive: false }));
        menu.addMenuItem(new PopupMenu.PopupMenuItem(state.title, { reactive: false }));
        if (state.detail)
            menu.addMenuItem(new PopupMenu.PopupMenuItem(state.detail, { reactive: false }));
        if (state.actions.length)
            menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        for (const action of state.actions) {
            const name = action === 'approvals' ? `Approvals (${state.approvals})…` : ACTIONS[action];
            menu.addAction(name, () => this._open(action));
        }
    }
    _open(page) {
        const path = `${this.path}/app.js`;
        try {
            Gio.Subprocess.new(['gjs', '-m', path, page], Gio.SubprocessFlags.NONE);
        }
        catch (error) {
            Main.notify('Cheesecloth', error instanceof Error ? error.message : String(error));
        }
    }
}
