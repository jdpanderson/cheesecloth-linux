import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import Pango from 'gi://Pango';
import { pathLevel, permissionBadges, permissionNames, roleBadges } from './display.js';
const LEVEL_CLASSES = {
    good: 'success', attention: 'warning', broken: 'error', off: 'dim-label', info: 'accent',
};
export function setLevel(widget, level) {
    for (const name of Object.values(LEVEL_CLASSES))
        widget.remove_css_class(name);
    if (level)
        widget.add_css_class(LEVEL_CLASSES[level]);
}
// One row of the peers table. Setting `peer` updates the cells that show it.
const PeerItem = GObject.registerClass({
    GTypeName: 'CheeseclothPeerItem',
    Properties: { peer: GObject.ParamSpec.jsobject('peer', 'Peer', 'The peer this row shows', GObject.ParamFlags.READWRITE) },
}, class PeerItem extends GObject.Object {
    _peer;
    get peer() {
        return this._peer;
    }
    set peer(value) {
        this._peer = value;
        this.notify('peer');
    }
});
function control(peer) {
    return peer.connected ? 'Yes' : peer.present ? 'Relay' : 'No';
}
// Pads each part, so addresses sort in number order as text.
function ipv4Key(peer) {
    return peer.ipv4 ? peer.ipv4.split('.').map(part => part.padStart(3, '0')).join('.') : null;
}
const COLUMNS = [
    { title: 'Name', text: peer => `${peer.name}${peer.this_node ? ' (this computer)' : ''}`, key: peer => peer.name },
    { title: 'Present', text: peer => peer.present ? 'Yes' : 'No', level: peer => peer.present ? 'good' : 'off' },
    { title: 'IPv4', text: peer => peer.ipv4 || '—', key: ipv4Key },
    { title: 'Role', badges: roleBadges, key: peer => roleBadges(peer).map(badge => badge.tooltip).join() },
    { title: 'Permissions', badges: peer => permissionBadges(peer.permissions), key: peer => permissionNames(peer.permissions) },
    { title: 'Control', text: control, level: peer => peer.connected ? 'good' : 'off' },
    { title: 'Path', text: peer => peer.path },
    { title: 'State', text: peer => peer.path_detail, level: peer => pathLevel(peer.path_state, peer.this_node), expand: true },
    { title: 'Endpoint', text: peer => peer.wg_endpoint || '—', key: peer => peer.wg_endpoint },
    { title: 'Handshake', text: peer => peer.handshake_age_secs == null ? '—' : `${peer.handshake_age_secs}s ago`,
        key: peer => peer.handshake_age_secs },
];
// Empty values sort last in both directions of the first click.
function compare(a, b) {
    if (a === null || b === null)
        return a === b ? 0 : a === null ? 1 : -1;
    if (typeof a === 'number' && typeof b === 'number')
        return Math.sign(a - b);
    return Math.sign(String(a).localeCompare(String(b)));
}
// Calls `show` when a cell is bound to a peer, and again each time that peer changes while the cell shows it.
// There is no unbind handler: GTK unbinds cells while the garbage collector frees the view, and GJS blocks JS
// calls then. Instead, binding a cell again replaces its handler, and a handler does nothing after its cell
// shows another item.
function onPeer(factory, show) {
    const handlers = new WeakMap();
    factory.connect('bind', (_factory, cell) => {
        const previous = handlers.get(cell);
        if (previous)
            previous[0].disconnect(previous[1]);
        const item = cell.get_item();
        show(cell, item.peer);
        handlers.set(cell, [item, item.connect('notify::peer', () => {
                if (cell.get_item() === item)
                    show(cell, item.peer);
            })]);
    });
}
function textColumn(column) {
    const factory = new Gtk.SignalListItemFactory();
    factory.connect('setup', (_factory, cell) => {
        cell.set_child(new Gtk.Label({ xalign: 0, ellipsize: Pango.EllipsizeMode.END }));
    });
    onPeer(factory, (cell, peer) => {
        const text = cell.get_child();
        text.set_text(column.text(peer));
        text.set_tooltip_text(column.text(peer));
        setLevel(text, column.level?.(peer) ?? '');
    });
    const key = column.key ?? column.text;
    return new Gtk.ColumnViewColumn({ title: column.title, factory, resizable: true, expand: column.expand ?? false,
        sorter: Gtk.CustomSorter.new((a, b) => compare(key(a.peer), key(b.peer))) });
}
function badgeColumn(column) {
    const factory = new Gtk.SignalListItemFactory();
    factory.connect('setup', (_factory, cell) => {
        cell.set_child(new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 6 }));
    });
    onPeer(factory, (cell, peer) => {
        const icons = cell.get_child();
        let child;
        while ((child = icons.get_first_child()))
            icons.remove(child);
        for (const badge of column.badges(peer)) {
            const image = new Gtk.Image({ icon_name: badge.icon });
            image.set_tooltip_text(badge.tooltip);
            image.update_property([Gtk.AccessibleProperty.LABEL], [badge.tooltip]);
            if (badge.dim)
                image.add_css_class('dim-label');
            icons.append(image);
        }
    });
    return new Gtk.ColumnViewColumn({ title: column.title, factory, resizable: true,
        sorter: Gtk.CustomSorter.new((a, b) => compare(column.key(a.peer), column.key(b.peer))) });
}
function actionsColumn(actions) {
    const factory = new Gtk.SignalListItemFactory();
    const rows = new WeakMap();
    factory.connect('setup', (_factory, cell) => {
        const menu = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
        const popover = new Gtk.Popover();
        popover.add_css_class('menu');
        popover.set_child(menu);
        const more = new Gtk.MenuButton({ icon_name: 'view-more-symbolic', popover });
        more.add_css_class('flat');
        const add = (text, action) => {
            const entry = new Gtk.Button({ label: text });
            entry.add_css_class('flat');
            entry.connect('clicked', () => {
                popover.popdown();
                const item = cell.get_item();
                if (item)
                    action(item.peer);
            });
            menu.append(entry);
            return entry;
        };
        add('Copy IP', peer => actions.copy(peer.ipv4));
        add('Copy Name', peer => actions.copy(peer.name));
        const removePeer = actions.remove;
        const remove = removePeer ? add('Remove…', peer => removePeer(peer, more)) : null;
        cell.set_child(more);
        rows.set(cell, { more, remove });
    });
    onPeer(factory, (cell, peer) => {
        const row = rows.get(cell);
        row?.more.set_tooltip_text(`Actions for ${peer.name}`);
        row?.remove?.set_visible(!peer.this_node);
    });
    return new Gtk.ColumnViewColumn({ title: '', factory });
}
export class PeerTable {
    widget;
    view;
    store;
    items = new Map();
    ids = '';
    constructor(actions) {
        this.store = new Gio.ListStore({ item_type: PeerItem.$gtype });
        this.view = new Gtk.ColumnView();
        for (const column of COLUMNS)
            this.view.append_column('badges' in column ? badgeColumn(column) : textColumn(column));
        this.view.append_column(actionsColumn(actions));
        this.view.set_model(new Gtk.NoSelection({ model: new Gtk.SortListModel({ model: this.store, sorter: this.view.get_sorter() }) }));
        this.widget = new Gtk.ScrolledWindow({ hexpand: true, vexpand: true });
        this.widget.set_child(this.view);
    }
    // Updates rows in place, so open menus and the scroll position stay. The list is replaced only
    // when peers join or leave.
    update(peers) {
        let changed = false;
        const items = peers.map(peer => {
            let item = this.items.get(peer.node_id);
            if (!item) {
                item = new PeerItem();
                item.peer = peer;
            }
            else if (JSON.stringify(item.peer) !== JSON.stringify(peer)) {
                item.peer = peer;
                changed = true;
            }
            return item;
        });
        this.items = new Map(items.map(item => [item.peer.node_id, item]));
        const ids = JSON.stringify(peers.map(peer => peer.node_id));
        if (ids !== this.ids) {
            this.ids = ids;
            this.store.splice(0, this.store.get_n_items(), items);
        }
        else if (changed) {
            // New values may belong in a different place in the sorted order.
            this.view.get_sorter()?.changed(Gtk.SorterChange.DIFFERENT);
        }
    }
}
