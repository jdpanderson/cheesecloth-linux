import GObject from 'gi://GObject';
import Gdk from 'gi://Gdk?version=4.0';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk?version=4.0';
import Pango from 'gi://Pango';
import type {ListStore} from 'gi://Gio';
import type {Box, Button, ColumnView, ColumnViewCell, ColumnViewColumn, Label, MenuButton, ScrolledWindow,
    SignalListItemFactory, Widget} from 'gi://Gtk?version=4.0';

import {LEVEL_ORDER, pathLight, permissionBadges, permissionNames, roleBadges, type Badge, type Level,
    type Light} from './display.js';
import type {Peer} from './types.js';

const LEVEL_CLASSES: Record<Level, string> = {
    good: 'success', attention: 'warning', degraded: 'cheesecloth-degraded', broken: 'error', off: 'dim-label',
    info: 'accent',
};

// Adwaita has no orange style class, so `degraded` uses orange 3 of the GNOME palette.
const STYLES = '.cheesecloth-degraded { color: #ff7800; }';

// Call once, before the first window.
export function loadStyles(): void {
    const display = Gdk.Display.get_default();
    if (!display)
        return;
    const provider = new Gtk.CssProvider();
    provider.load_from_string(STYLES);
    Gtk.StyleContext.add_provider_for_display(display, provider, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION);
}

export function setLevel(widget: Widget, level: Level | ''): void {
    for (const name of Object.values(LEVEL_CLASSES))
        widget.remove_css_class(name);
    if (level)
        widget.add_css_class(LEVEL_CLASSES[level]);
}

// One row of the peers table. Setting `peer` updates the cells that show it.
const PeerItem = GObject.registerClass({
    GTypeName: 'CheeseclothPeerItem',
    Properties: {peer: GObject.ParamSpec.jsobject('peer', 'Peer', 'The peer this row shows', GObject.ParamFlags.READWRITE)},
}, class PeerItem extends GObject.Object {
    private _peer!: Peer;

    get peer(): Peer {
        return this._peer;
    }

    set peer(value: Peer) {
        this._peer = value;
        this.notify('peer');
    }
});
type PeerItem = InstanceType<typeof PeerItem>;

interface Column {
    title: string;
    text: (peer: Peer) => string;
    // The value to sort by. Without it, the column sorts by its text.
    key?: (peer: Peer) => string | number | null;
    level?: (peer: Peer) => Level | '';
    expand?: boolean;
}

// A column of icons, each with a tooltip. It sorts by `key`.
interface BadgeColumn {
    title: string;
    badges: (peer: Peer) => Badge[];
    key: (peer: Peer) => string;
}

// A column of colored lights, each with a tooltip. It sorts problems first.
interface LightColumn {
    title: string;
    light: (peer: Peer) => Light;
}

function control(peer: Peer): string {
    return peer.connected ? 'Yes' : peer.present ? 'Relay' : 'No';
}

// Pads each part, so addresses sort in number order as text.
function ipv4Key(peer: Peer): string | null {
    return peer.ipv4 ? peer.ipv4.split('.').map(part => part.padStart(3, '0')).join('.') : null;
}

const COLUMNS: (Column | BadgeColumn | LightColumn)[] = [
    {title: 'Name', text: peer => `${peer.name}${peer.this_node ? ' (this computer)' : ''}`, key: peer => peer.name,
        expand: true},
    {title: 'Present', text: peer => peer.present ? 'Yes' : 'No', level: peer => peer.present ? 'good' : 'off'},
    {title: 'IPv4', text: peer => peer.ipv4 || '—', key: ipv4Key},
    {title: 'Role', badges: roleBadges, key: peer => roleBadges(peer).map(badge => badge.tooltip).join()},
    {title: 'Permissions', badges: peer => permissionBadges(peer.permissions), key: peer => permissionNames(peer.permissions)},
    {title: 'Control', text: control, level: peer => peer.connected ? 'good' : 'off'},
    {title: 'Path', text: peer => peer.path},
    {title: 'State', light: pathLight},
    {title: 'Endpoint', text: peer => peer.wg_endpoint || '—', key: peer => peer.wg_endpoint},
    {title: 'Handshake', text: peer => peer.handshake_age_secs == null ? '—' : `${peer.handshake_age_secs}s ago`,
        key: peer => peer.handshake_age_secs},
];

// Empty values sort last in both directions of the first click.
function compare(a: string | number | null, b: string | number | null): number {
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
function onPeer(factory: SignalListItemFactory, show: (cell: ColumnViewCell, peer: Peer) => void): void {
    const handlers = new WeakMap<ColumnViewCell, [PeerItem, number]>();
    factory.connect('bind', (_factory, cell) => {
        const previous = handlers.get(cell);
        if (previous)
            previous[0].disconnect(previous[1]);
        const item = cell.get_item() as PeerItem;
        show(cell, item.peer);
        handlers.set(cell, [item, item.connect('notify::peer', () => {
            if (cell.get_item() === item)
                show(cell, item.peer);
        })]);
    });
}

function textColumn(column: Column): ColumnViewColumn {
    const factory = new Gtk.SignalListItemFactory();
    factory.connect('setup', (_factory, cell) => {
        cell.set_child(new Gtk.Label({xalign: 0, ellipsize: Pango.EllipsizeMode.END}));
    });
    onPeer(factory, (cell, peer) => {
        const text = cell.get_child() as Label;
        text.set_text(column.text(peer));
        text.set_tooltip_text(column.text(peer));
        setLevel(text, column.level?.(peer) ?? '');
    });
    const key = column.key ?? column.text;
    return new Gtk.ColumnViewColumn({title: column.title, factory, resizable: true, expand: column.expand ?? false,
        sorter: Gtk.CustomSorter.new((a, b) => compare(key((a as PeerItem).peer), key((b as PeerItem).peer)))});
}

function badgeColumn(column: BadgeColumn): ColumnViewColumn {
    const factory = new Gtk.SignalListItemFactory();
    factory.connect('setup', (_factory, cell) => {
        cell.set_child(new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 6}));
    });
    onPeer(factory, (cell, peer) => {
        const icons = cell.get_child() as Box;
        let child: Widget | null;
        while ((child = icons.get_first_child()))
            icons.remove(child);
        for (const badge of column.badges(peer)) {
            const image = new Gtk.Image({icon_name: badge.icon});
            image.set_tooltip_text(badge.tooltip);
            image.update_property([Gtk.AccessibleProperty.LABEL], [badge.tooltip]);
            if (badge.dim)
                image.add_css_class('dim-label');
            icons.append(image);
        }
    });
    return new Gtk.ColumnViewColumn({title: column.title, factory, resizable: true,
        sorter: Gtk.CustomSorter.new((a, b) => compare(column.key((a as PeerItem).peer), column.key((b as PeerItem).peer)))});
}

function lightColumn(column: LightColumn): ColumnViewColumn {
    const factory = new Gtk.SignalListItemFactory();
    factory.connect('setup', (_factory, cell) => {
        cell.set_child(new Gtk.Label({label: '●', xalign: 0.5}));
    });
    onPeer(factory, (cell, peer) => {
        const dot = cell.get_child() as Label;
        const light = column.light(peer);
        dot.set_tooltip_text(light.tooltip);
        dot.update_property([Gtk.AccessibleProperty.LABEL], [light.tooltip]);
        setLevel(dot, light.level);
    });
    const key = (item: unknown): number => LEVEL_ORDER.indexOf(column.light((item as PeerItem).peer).level);
    return new Gtk.ColumnViewColumn({title: column.title, factory, resizable: true,
        sorter: Gtk.CustomSorter.new((a, b) => compare(key(a), key(b)))});
}

export interface PeerActions {
    copy(text: string): void;
    // `button` is the row's menu button, which stays disabled while the removal runs. Without it, the
    // rows have no Remove item, as for a member without the admin permission.
    remove?: (peer: Peer, button: MenuButton) => void;
}

function actionsColumn(actions: PeerActions): ColumnViewColumn {
    const factory = new Gtk.SignalListItemFactory();
    const rows = new WeakMap<ColumnViewCell, {more: MenuButton; remove: Button | null}>();
    factory.connect('setup', (_factory, cell) => {
        const menu = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, spacing: 8});
        const popover = new Gtk.Popover();
        popover.add_css_class('menu');
        popover.set_child(menu);
        const more = new Gtk.MenuButton({icon_name: 'view-more-symbolic', popover});
        more.add_css_class('flat');
        const add = (text: string, action: (peer: Peer) => void): Button => {
            const entry = new Gtk.Button({label: text});
            entry.add_css_class('flat');
            entry.connect('clicked', () => {
                popover.popdown();
                const item = cell.get_item() as PeerItem | null;
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
        rows.set(cell, {more, remove});
    });
    onPeer(factory, (cell, peer) => {
        const row = rows.get(cell);
        row?.more.set_tooltip_text(`Actions for ${peer.name}`);
        row?.remove?.set_visible(!peer.this_node);
    });
    return new Gtk.ColumnViewColumn({title: '', factory});
}

export class PeerTable {
    readonly widget: ScrolledWindow;
    private readonly view: ColumnView;
    private readonly store: ListStore;
    private items = new Map<string, PeerItem>();
    private ids = '';

    constructor(actions: PeerActions) {
        this.store = new Gio.ListStore({item_type: PeerItem.$gtype});
        this.view = new Gtk.ColumnView();
        for (const column of COLUMNS)
            this.view.append_column('badges' in column ? badgeColumn(column) :
                'light' in column ? lightColumn(column) : textColumn(column));
        this.view.append_column(actionsColumn(actions));
        this.view.set_model(new Gtk.NoSelection({model: new Gtk.SortListModel({model: this.store, sorter: this.view.get_sorter()})}));
        this.widget = new Gtk.ScrolledWindow({hexpand: true, vexpand: true});
        this.widget.set_child(this.view);
    }

    // Updates rows in place, so open menus and the scroll position stay. The list is replaced only
    // when peers join or leave.
    update(peers: Peer[]): void {
        let changed = false;
        const items = peers.map(peer => {
            let item = this.items.get(peer.node_id);
            if (!item) {
                item = new PeerItem();
                item.peer = peer;
            } else if (JSON.stringify(item.peer) !== JSON.stringify(peer)) {
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
        } else if (changed) {
            // New values may belong in a different place in the sorted order.
            this.view.get_sorter()?.changed(Gtk.SorterChange.DIFFERENT);
        }
    }
}
