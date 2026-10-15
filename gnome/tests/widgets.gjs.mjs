import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';

import {PeerTable} from '../dist/widgets.js';

const app = new Adw.Application({
    application_id: 'ca.janderson.cheesecloth.WidgetTest',
    flags: Gio.ApplicationFlags.NON_UNIQUE,
});
if (!app.register(null))
    throw new Error('Adwaita did not initialize.');

const window = new Adw.ApplicationWindow({application: app});
const toolbar = new Adw.ToolbarView();
toolbar.add_top_bar(new Adw.HeaderBar());
const group = new Adw.PreferencesGroup();
group.add(new Adw.EntryRow({title: 'IPv4 range'}));
group.add(new Adw.SwitchRow({title: 'Strict security'}));
toolbar.set_content(group);
window.set_content(toolbar);
window.present();

const dialog = new Adw.AlertDialog({heading: 'Leave?', body: 'Confirm leaving.'});
dialog.add_response('cancel', 'Cancel');
dialog.add_response('confirm', 'Leave');
dialog.set_close_response('cancel');
dialog.set_response_appearance('confirm', Adw.ResponseAppearance.DESTRUCTIVE);
dialog.present(window);
dialog.close();

// The peers table shows each peer, updates rows in place and follows joins and leaves.
function peer(name, fields = {}) {
    return {node_id: `id-${name}`, name, ipv4: '100.64.0.2', acceptor: false, relay: false, this_node: false,
        permissions: {admin: true, vote: true, relay: true}, connected: true, present: true, path: 'direct', path_state: 'up', path_detail: 'Up', retry_in_secs: null,
        wg_endpoint: '192.0.2.1:51820', handshake_age_secs: 5, ...fields};
}

function texts(widget) {
    const found = widget instanceof Gtk.Label ? [widget.get_text()] : [];
    for (let child = widget.get_first_child(); child; child = child.get_next_sibling())
        found.push(...texts(child));
    return found;
}

function waitFor(condition, what) {
    const context = GLib.MainContext.default();
    const end = Date.now() + 5000;
    while (!condition()) {
        if (Date.now() > end)
            throw new Error(`The peers table did not show ${what}. It shows: ${texts(table.widget).join(', ')}`);
        context.iteration(false);
    }
}

const table = new PeerTable({copy() {}, remove() {}});
window.set_content(table.widget);
table.update([peer('alpha', {this_node: true}), peer('beta')]);
waitFor(() => texts(table.widget).includes('alpha (this computer)') && texts(table.widget).includes('beta'),
    'both peers');
table.update([peer('alpha', {this_node: true}), peer('beta', {handshake_age_secs: 42})]);
waitFor(() => texts(table.widget).includes('42s ago'), 'the new handshake age');
table.update([peer('alpha', {this_node: true})]);
waitFor(() => !texts(table.widget).includes('beta'), 'that beta left');
// Each row shows what the member does now, and what it may do.
table.update([peer('alpha', {this_node: true, acceptor: true}),
    peer('router', {acceptor: true, relay: true, permissions: {admin: false, vote: true, relay: true}}),
    peer('friend', {permissions: {admin: false, vote: false, relay: false}})]);
waitFor(() => ['Acceptor', 'Acceptor, Relay', 'All', 'Voter, Relay', 'Member']
    .every(text => texts(table.widget).includes(text)), 'each role and permissions');
waitFor(() => texts(table.widget).includes('Remove…'), 'a Remove item');

// Without a remove action, as for a member without the admin permission, no row has a Remove item.
const passive = new PeerTable({copy() {}});
window.set_content(passive.widget);
passive.update([peer('alpha', {this_node: true}), peer('beta')]);
waitFor(() => texts(passive.widget).includes('Copy IP'), 'the row actions');
if (texts(passive.widget).includes('Remove…'))
    throw new Error('The peers table shows Remove without a remove action.');
window.close();
