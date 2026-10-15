import Gio from 'gi://Gio';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import type {Button as PanelButton} from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

import {ApiError, call, type Cancellable} from './api.js';
import {SEPARATOR, errorState, menuState, type MenuAction, type MenuState} from './display.js';

const ACTIONS: Record<MenuAction, string> = {
    status: 'Status…',
    peers: 'Peers…',
    approvals: 'Approvals…',
    create: 'Create Network…',
    join: 'Join Network…',
    cancel: 'Cancel Join…',
    retry: 'Retry Leave…',
    logs: 'Open Logs…',
};

// Icon names from the icon theme, shown to the left of the menu item.
const ICONS: Partial<Record<MenuAction, string>> = {
    status: 'dialog-information-symbolic',
    peers: 'system-users-symbolic',
};

export default class CheeseclothExtension extends Extension {
    private _indicator: PanelButton | null = null;
    private _cancellable: Cancellable | null = null;

    enable(): void {
        this._indicator = new PanelMenu.Button(0.0, 'Cheesecloth');
        // The name ends in -symbolic, so the Shell colors the icon to match the panel.
        this._indicator.add_child(new St.Icon({
            gicon: Gio.icon_new_for_string(`${this.path}/cheesecloth-symbolic.svg`),
            style_class: 'system-status-icon',
        }));
        this._indicator.menu.connect('open-state-changed', (_menu, open) => {
            if (open)
                this._refresh();
            else
                this._cancellable?.cancel();
        });
        Main.panel.addToStatusArea(this.uuid, this._indicator);
        this._render({title: 'Starting…', detail: '', level: 'off', actions: []});
    }

    disable(): void {
        this._cancellable?.cancel();
        this._indicator?.destroy();
        this._indicator = null;
    }

    private async _refresh(): Promise<void> {
        if (!this._indicator)
            return;
        this._cancellable?.cancel();
        const cancellable = new Gio.Cancellable();
        this._cancellable = cancellable;
        try {
            const status = await call('status', {}, cancellable);
            const proposals = status.phase === 'member' && status.permissions?.admin
                ? await call('pending', {}, cancellable) : [];
            if (!cancellable.is_cancelled())
                this._render(menuState(status, proposals));
        } catch (error) {
            if (!cancellable.is_cancelled())
                this._render(errorState(error instanceof ApiError ? error :
                    {message: error instanceof Error ? error.message : String(error)}));
        } finally {
            if (this._cancellable === cancellable)
                this._cancellable = null;
        }
    }

    private _render(state: MenuState): void {
        if (!this._indicator)
            return;
        const menu = this._indicator.menu;
        menu.removeAll();
        menu.addMenuItem(new PopupMenu.PopupMenuItem(`Cheesecloth${SEPARATOR}${state.title}`, {reactive: false}));
        if (state.detail)
            menu.addMenuItem(new PopupMenu.PopupMenuItem(state.detail, {reactive: false}));
        if (state.actions.length)
            menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        for (const action of state.actions) {
            const name = action === 'approvals' ? `Approvals (${state.approvals})…` : ACTIONS[action];
            menu.addAction(name, () => this._open(action), ICONS[action]);
        }
    }

    private _open(page: MenuAction): void {
        const path = `${this.path}/app.js`;
        try {
            Gio.Subprocess.new(['gjs', '-m', path, page], Gio.SubprocessFlags.NONE);
        } catch (error) {
            Main.notify('Cheesecloth', error instanceof Error ? error.message : String(error));
        }
    }
}
