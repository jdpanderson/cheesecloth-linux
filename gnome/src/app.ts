import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Pango from 'gi://Pango';
import type {Subprocess} from 'gi://Gio';
import type {Box, Button, CheckButton, Label, ScrolledWindow, Stack, Widget, Window as GtkWindow} from 'gi://Gtk?version=4.0';
import type {ApplicationWindow} from 'gi://Adw?version=1';

import {call} from './api.js';
import {changeMessage, mapping, permissionNames, shortId, type Level} from './display.js';
import {PeerTable, setLevel} from './widgets.js';
import type {Invite, Peer, Proposal, Status} from './types.js';

type PageKind = 'status' | 'peers' | 'approvals' | 'invite' | 'join' | 'create' |
    'cancel' | 'retry' | 'logs';

const HELP = {
    consensus: 'Available: enough acceptors can be reached to agree on changes. Changes paused: too few can be reached, so joins, removals and setting changes wait. Traffic between members keeps flowing.',
    version: "The version of the network's agreed state (members and settings) that this computer holds. It goes up with each change.",
    acceptors: 'The members that vote on changes and keep the agreed state. There are at most 7.',
    config: 'The number of the current group of acceptors. It goes up each time the group changes.',
    security: 'Protected: changes stay safe even if one acceptor is compromised and lies. It needs at least 4 acceptors. Relaxed: changes are safe only while every acceptor is honest. This is normal for small networks.',
    quorum: 'The number of acceptor votes needed to agree on a change.',
    reachable: 'The acceptors this computer can reach now. When fewer than the quorum can be reached, changes pause.',
    strict: 'When on, a protected network does not fall back to relaxed when acceptors go away. It pauses changes instead.',
    permissions: 'What the member may do, set by its invite. Admin: invite, remove, approve and change settings. Voter: be an acceptor, and take joins to the network. Relay: relay messages for other members. All: all three. Member: none of them. Every member can use the network and leave. Permissions never change.',
    buffer: 'How many acceptors may be unreachable while changes still go through. A larger buffer needs more acceptors before protection starts.',
};

const app = new Adw.Application({application_id: 'ca.janderson.cheesecloth.Gnome', flags: Gio.ApplicationFlags.NON_UNIQUE});

function label(text: unknown, css = '', selectable = true): Label {
    const widget = new Gtk.Label({label: String(text ?? '—'), xalign: 0, wrap: true, selectable});
    if (css)
        widget.add_css_class(css);
    return widget;
}

function dot(level: Level): Label {
    const widget = label('●', '', false);
    setLevel(widget, level);
    return widget;
}

function overviewState(status: Status): {text: string; level: Level} {
    if (status.phase === 'none')
        return {text: 'Not in a network', level: 'off'};
    if (status.phase === 'pending')
        return {text: 'Waiting for approval', level: 'attention'};
    if (status.phase === 'stopping')
        return {text: 'Leaving', level: 'attention'};
    return status.warnings.length ?
        {text: `${status.warnings.length} warnings`, level: 'attention'} :
        {text: 'Healthy', level: 'good'};
}

function box(spacing = 10, orientation: number = Gtk.Orientation.VERTICAL): Box {
    return new Gtk.Box({orientation, spacing});
}

function button(text: string, action: () => void): Button {
    const widget = new Gtk.Button({label: text});
    widget.connect('clicked', action);
    return widget;
}

interface RowView {
    value: Label;
    hint: {text: string; button: Button} | null;
    // The value is cut in the middle to fit, and its tooltip shows all of it.
    shorten: boolean;
}

function row(parent: Box, name: string, value: unknown, help = '', level: Level | '' = '', shorten = false): RowView {
    const line = box(10, Gtk.Orientation.HORIZONTAL);
    const title = label(name);
    title.set_size_request(150, -1);
    line.append(title);
    const detail = label(value);
    setLevel(detail, level);
    detail.set_hexpand(true);
    if (shorten) {
        detail.set_wrap(false);
        detail.set_ellipsize(Pango.EllipsizeMode.MIDDLE);
        detail.set_tooltip_text(detail.get_text());
    }
    line.append(detail);
    const hint: RowView['hint'] = help ? {text: help,
        button: new Gtk.Button({icon_name: 'dialog-information-symbolic'})} : null;
    if (hint) {
        hint.button.set_tooltip_text(hint.text);
        hint.button.connect('clicked', () => {
            const root = parent.get_root();
            if (root)
                message(root, name, hint.text);
        });
        line.append(hint.button);
    }
    parent.append(line);
    return {value: detail, hint, shorten};
}

function padded(): Box {
    const content = box(12);
    content.set_margin_top(18);
    content.set_margin_bottom(18);
    content.set_margin_start(18);
    content.set_margin_end(18);
    return content;
}

function page(): [ScrolledWindow, Box] {
    const content = padded();
    const scroll = new Gtk.ScrolledWindow({hexpand: true, vexpand: true});
    scroll.set_child(content);
    return [scroll, content];
}

function message(parent: GtkWindow, title: string, text: string): void {
    const dialog = new Adw.AlertDialog({heading: title, body: text});
    dialog.add_response('close', 'Close');
    dialog.set_close_response('close');
    dialog.present(parent);
}

function confirm(parent: GtkWindow, title: string, detail: string, action: string, cancel = 'Cancel'): Promise<boolean> {
    return new Promise<boolean>(resolve => {
        const dialog = new Adw.AlertDialog({heading: title, body: detail});
        dialog.add_response('cancel', cancel);
        dialog.add_response('confirm', action);
        dialog.set_default_response('cancel');
        dialog.set_close_response('cancel');
        dialog.set_response_appearance('confirm', Adw.ResponseAppearance.DESTRUCTIVE);
        dialog.connect('response', (_dialog, response) => resolve(response === 'confirm'));
        dialog.present(parent);
    });
}

class Window {
    private readonly kind: PageKind;
    private readonly window: ApplicationWindow;
    private readonly root: Box;
    private readonly notice: Label;
    private body: Widget | null = null;
    private stack: Stack | null = null;
    private invite: Invite | null = null;
    private timer = 0;
    private countdown = 0;
    private loading = false;
    private busy = false;
    private readonly cancellable = new Gio.Cancellable();
    private statusMember: boolean | null = null;
    private statusFields = new Map<string, RowView>();
    private statusDots = new Map<string, Label>();
    private statusBadge!: Label;
    private statusWarnings!: Box;
    private lastWarnings = '';
    private peerTable: PeerTable | null = null;
    private peerCount!: Label;
    private peerEmpty!: Label;
    private approvalContent: Box | null = null;
    private approvalIds = '';
    private approvalFields = new Map<string, {count: Label; time: Label}>();
    private logsProcess: Subprocess | null = null;

    constructor(kind: PageKind) {
        this.kind = kind;
        // The invite window holds the permissions and a long token, so it is larger than the other small windows.
        this.window = new Adw.ApplicationWindow({application: app, title: 'Cheesecloth',
            default_width: kind === 'peers' ? 1000 : kind === 'status' ? 760 : kind === 'invite' ? 640 : 540,
            default_height: kind === 'status' || kind === 'peers' ? 540 : kind === 'invite' ? 680 : 400});
        this.root = box(0);
        const toolbar = new Adw.ToolbarView();
        const header = new Adw.HeaderBar();
        header.set_title_widget(label(this.title(), 'title-3'));
        toolbar.add_top_bar(header);
        toolbar.set_content(this.root);
        this.notice = label('');
        this.notice.set_margin_start(18);
        this.notice.set_margin_end(18);
        this.root.append(this.notice);
        this.window.set_content(toolbar);
        this.window.connect('close-request', () => {
            if (this.timer)
                GLib.source_remove(this.timer);
            this.timer = 0;
            if (this.countdown)
                GLib.source_remove(this.countdown);
            this.countdown = 0;
            this.cancellable.cancel();
            this.logsProcess?.force_exit();
            return false;
        });
        this.window.present();
        this.refresh();
        if (['status', 'peers', 'approvals'].includes(kind)) {
            this.timer = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
                this.refresh();
                return GLib.SOURCE_CONTINUE;
            });
        }
    }

    title(): string {
        const titles: Record<PageKind, string> = {status: 'Status', peers: 'Peers', approvals: 'Approvals', invite: 'Invite',
            join: 'Join Network', create: 'Create Network', cancel: 'Cancel Join',
            retry: 'Retry Leave', logs: 'Logs'};
        return titles[this.kind];
    }

    // Opens another page and closes this one. The new window opens first, so the app keeps running.
    replace(kind: PageKind): void {
        if (this.cancellable.is_cancelled())
            return;
        new Window(kind);
        this.window.close();
    }

    setBody(widget: Widget): void {
        if (this.body)
            this.root.remove(this.body);
        this.body = widget;
        this.root.append(widget);
    }

    async run(widget: Widget, operation: () => Promise<string>): Promise<boolean> {
        if (this.busy || this.cancellable.is_cancelled())
            return false;
        this.busy = true;
        widget.set_sensitive(false);
        this.notice.set_text('Working…');
        try {
            const result = await operation();
            if (!this.cancellable.is_cancelled())
                this.notice.set_text(result || 'Done.');
            return true;
        } catch (error) {
            if (!this.cancellable.is_cancelled())
                this.notice.set_text(error instanceof Error ? error.message : String(error));
            return false;
        } finally {
            if (!this.cancellable.is_cancelled())
                widget.set_sensitive(true);
            this.busy = false;
        }
    }

    async refresh(): Promise<void> {
        if (this.loading || this.busy || this.cancellable.is_cancelled())
            return;
        this.loading = true;
        try {
            switch (this.kind) {
            case 'status': {
                const status = await call('status', {}, this.cancellable);
                if (!this.cancellable.is_cancelled()) this.showStatus(status);
                break;
            }
            case 'peers': {
                const peers = await call('peers', {}, this.cancellable);
                if (!this.cancellable.is_cancelled()) this.showPeers(peers);
                break;
            }
            case 'approvals': {
                const proposals = await call('pending', {}, this.cancellable);
                if (!this.cancellable.is_cancelled()) this.showApprovals(proposals);
                break;
            }
            case 'create': this.showCreate(); break;
            case 'join': this.showJoin(); break;
            case 'invite': this.showInvite(); break;
            case 'cancel': this.showLeave(true); break;
            case 'retry': this.showLeave(false); break;
            case 'logs': await this.showLogs(); break;
            }
        } catch (error) {
            if (!this.cancellable.is_cancelled())
                this.notice.set_text(error instanceof Error ? error.message : String(error));
        } finally {
            this.loading = false;
        }
    }

    showStatus(status: Status): void {
        const member = status.phase === 'member';
        if (this.statusMember === member && this.body) {
            this.updateStatus(status);
            return;
        }
        const current = this.stack?.get_visible_child_name() || 'overview';
        this.statusMember = member;
        this.statusFields.clear();
        this.statusDots.clear();
        this.lastWarnings = '';
        const layout = box(0, Gtk.Orientation.HORIZONTAL);
        const stack = new Gtk.Stack({hexpand: true, vexpand: true});
        this.stack = stack;
        const sidebar = box(4);
        sidebar.set_size_request(175, -1);
        sidebar.set_margin_top(18);
        sidebar.set_margin_start(12);
        const addRow = (section: string, parent: Box, name: string, value: unknown,
            help = '', level: Level | '' = '', shorten = false): void => {
            this.statusFields.set(`${section}/${name}`, row(parent, name, value, help, level, shorten));
        };
        const addSection = (name: string, title: string, level: Level, widget: Widget): void => {
            stack.add_titled(widget, name, title);
            const entry = new Gtk.Button();
            entry.add_css_class('flat');
            const contents = box(8, Gtk.Orientation.HORIZONTAL);
            const indicator = dot(level);
            this.statusDots.set(name, indicator);
            contents.append(indicator);
            // A selectable label would take the click from the button.
            contents.append(label(title, '', false));
            entry.set_child(contents);
            entry.connect('clicked', () => stack.set_visible_child_name(name));
            sidebar.append(entry);
        };
        layout.append(sidebar);
        layout.append(new Gtk.Separator({orientation: Gtk.Orientation.VERTICAL}));
        layout.append(stack);
        const [overviewScroll, overview] = page();
        this.statusWarnings = box(4);
        overview.append(this.statusWarnings);
        const overviewStatus = overviewState(status);
        const overviewBadge = label(overviewStatus.text, 'title-4');
        setLevel(overviewBadge, overviewStatus.level);
        this.statusBadge = overviewBadge;
        overview.append(overviewBadge);
        addRow('overview', overview, 'Node name', status.name);
        addRow('overview', overview, 'Node ID', status.node_id, '', '', true);
        addRow('overview', overview, 'Network ID', status.cluster_id, '', '', true);
        addRow('overview', overview, 'Members', status.members);
        addSection('overview', 'Overview', overviewStatus.level, overviewScroll);
        if (status.phase === 'member') {
            const [networkScroll, network] = page();
            addRow('network', network, 'Permissions', status.permissions && permissionNames(status.permissions),
                HELP.permissions);
            addRow('network', network, 'Reachability', status.public ? 'Public' : 'Behind NAT', '', status.public ? 'good' : 'off');
            addRow('network', network, 'Relay', status.relay ? 'Yes' : 'No');
            addRow('network', network, 'IPv4', status.ipv4);
            addRow('network', network, 'IPv6', status.ipv6);
            addRow('network', network, 'Conditions', `${status.public ? 'public' : 'behind NAT'}, keepalive ${status.keepalive ? `${status.keepalive}s` : 'off'}`);
            network.append(button('Leave Network…', async () => {
                if (await confirm(this.window, 'Leave the network?',
                    'This computer leaves and removes its WireGuard interface. It needs a new invite to come back.', 'Leave') &&
                    !this.cancellable.is_cancelled()) {
                    await this.leave(false);
                    await this.refresh();
                }
            }));
            addSection('network', 'Network', status.public ? 'good' : 'off', networkScroll);
            const [consensusScroll, consensus] = page();
            addRow('consensus', consensus, 'Status', status.changes_paused ? 'Changes paused' : 'Available', HELP.consensus,
                status.changes_paused ? 'attention' : 'good');
            addRow('consensus', consensus, 'State version', status.version, HELP.version);
            addRow('consensus', consensus, 'Acceptors', status.acceptors.length, HELP.acceptors);
            addRow('consensus', consensus, 'Configuration', status.config, HELP.config);
            addSection('consensus', 'Consensus', status.changes_paused ? 'attention' : 'good', consensusScroll);
            const [securityScroll, security] = page();
            addRow('security', security, 'Status', status.security === 'protected' ? 'Protected' : 'Relaxed', HELP.security,
                status.security === 'protected' ? 'good' : 'info');
            addRow('security', security, 'Quorum', status.quorum, HELP.quorum);
            addRow('security', security, 'Reachable', status.reachable_voters, HELP.reachable);
            addRow('security', security, 'Strict mode', status.strict_security ? 'On' : 'Off', HELP.strict);
            addRow('security', security, 'Buffer', status.buffer_nodes, HELP.buffer);
            addSection('security', 'Security', status.security === 'protected' ? 'good' : 'info', securityScroll);
            const [connectScroll, connectivity] = page();
            addRow('connectivity', connectivity, 'WireGuard', `${status.wg_backend || 'no interface'} on ${status.wg_interface || '—'}`);
            for (const [port, name, address] of [
                ['wireguard', 'WireGuard port', status.wg_port],
                ['control', 'Control port', status.control_addr],
            ] as const) {
                const [badge, level, hint] = mapping(status, port);
                addRow('connectivity', connectivity, name, `${address ?? '—'} • ${badge}`, hint, level);
            }
            const mappings = (['wireguard', 'control'] as const).map(port => mapping(status, port)[1]);
            const mappingLevel = mappings.includes('attention') ? 'attention' : mappings.includes('good') ? 'good' : 'off';
            addSection('connectivity', 'Connectivity', mappingLevel, connectScroll);
        }
        stack.set_visible_child_name(['overview', 'network', 'consensus', 'security', 'connectivity'].includes(current) &&
            (current === 'overview' || status.phase === 'member') ? current : 'overview');
        this.setBody(layout);
        this.updateStatus(status);
    }

    updateStatus(status: Status): void {
        const field = (section: string, name: string, value: unknown, level: Level | '' = '', hint?: string): void => {
            const view = this.statusFields.get(`${section}/${name}`);
            if (!view)
                return;
            view.value.set_text(String(value ?? '—'));
            if (view.shorten)
                view.value.set_tooltip_text(view.value.get_text());
            setLevel(view.value, level);
            if (view.hint && hint !== undefined) {
                view.hint.text = hint;
                view.hint.button.set_tooltip_text(hint);
            }
        };
        const section = (name: string, level: Level): void => {
            const dot = this.statusDots.get(name);
            if (dot)
                setLevel(dot, level);
        };
        const warnings = JSON.stringify(status.warnings);
        if (warnings !== this.lastWarnings) {
            this.lastWarnings = warnings;
            let child: Widget | null;
            while ((child = this.statusWarnings.get_first_child()))
                this.statusWarnings.remove(child);
            for (const warning of status.warnings)
                this.statusWarnings.append(label(warning, 'warning'));
        }
        const overview = overviewState(status);
        this.statusBadge.set_text(overview.text);
        setLevel(this.statusBadge, overview.level);
        section('overview', overview.level);
        field('overview', 'Node name', status.name);
        field('overview', 'Node ID', status.node_id);
        field('overview', 'Network ID', status.cluster_id);
        field('overview', 'Members', status.members);
        if (status.phase !== 'member')
            return;
        field('network', 'Permissions', status.permissions && permissionNames(status.permissions));
        field('network', 'Reachability', status.public ? 'Public' : 'Behind NAT', status.public ? 'good' : 'off');
        field('network', 'Relay', status.relay ? 'Yes' : 'No');
        field('network', 'IPv4', status.ipv4);
        field('network', 'IPv6', status.ipv6);
        field('network', 'Conditions', `${status.public ? 'public' : 'behind NAT'}, keepalive ${status.keepalive ? `${status.keepalive}s` : 'off'}`);
        section('network', status.public ? 'good' : 'off');
        field('consensus', 'Status', status.changes_paused ? 'Changes paused' : 'Available', status.changes_paused ? 'attention' : 'good');
        field('consensus', 'State version', status.version);
        field('consensus', 'Acceptors', status.acceptors.length);
        field('consensus', 'Configuration', status.config);
        section('consensus', status.changes_paused ? 'attention' : 'good');
        field('security', 'Status', status.security === 'protected' ? 'Protected' : 'Relaxed', status.security === 'protected' ? 'good' : 'info');
        field('security', 'Quorum', status.quorum);
        field('security', 'Reachable', status.reachable_voters);
        field('security', 'Strict mode', status.strict_security ? 'On' : 'Off');
        field('security', 'Buffer', status.buffer_nodes);
        section('security', status.security === 'protected' ? 'good' : 'info');
        field('connectivity', 'WireGuard', `${status.wg_backend || 'no interface'} on ${status.wg_interface || '—'}`);
        for (const [port, name, address] of [
            ['wireguard', 'WireGuard port', status.wg_port],
            ['control', 'Control port', status.control_addr],
        ] as const) {
            const [badge, level, hint] = mapping(status, port);
            field('connectivity', name, `${address ?? '—'} • ${badge}`, level, hint);
        }
        const mappings = (['wireguard', 'control'] as const).map(port => mapping(status, port)[1]);
        section('connectivity', mappings.includes('attention') ? 'attention' : mappings.includes('good') ? 'good' : 'off');
    }

    showPeers(peers: Peer[]): void {
        if (!this.peerTable) {
            const content = padded();
            const top = box(10, Gtk.Orientation.HORIZONTAL);
            this.peerCount = label('');
            this.peerCount.add_css_class('title-4');
            top.append(this.peerCount);
            // A member's permissions never change, so the first reply decides what this window offers.
            // Only an admin may invite or remove.
            const admin = peers.some(peer => peer.this_node && peer.permissions.admin);
            if (admin)
                top.append(button('Invite…', () => new Window('invite')));
            content.append(top);
            this.peerEmpty = label('No other members yet.');
            content.append(this.peerEmpty);
            this.peerTable = new PeerTable({
                copy: text => this.copy(text),
                remove: admin ? (peer, more) => this.removePeer(peer, more) : undefined,
            });
            content.append(this.peerTable.widget);
            content.append(label('Up: recent handshake • Other states need attention • No path: broken'));
            this.setBody(content);
        }
        this.peerCount.set_text(`${peers.length} member${peers.length === 1 ? '' : 's'}`);
        this.peerEmpty.set_visible(peers.every(peer => peer.this_node));
        this.peerTable.update(peers);
    }

    async removePeer(peer: Peer, more: Widget): Promise<void> {
        if (await confirm(this.window, `Remove ${peer.name} from the network?`, `Node ID ${peer.node_id}`, 'Remove') &&
            !this.cancellable.is_cancelled())
            await this.run(more, async () => changeMessage(await call('remove', {node: peer.node_id}, this.cancellable), peer.name));
        await this.refresh();
    }

    copy(text: string | null): void {
        this.window.get_clipboard().set_text(text || '');
        this.notice.set_text('Copied.');
    }

    showInvite(): void {
        if (this.body)
            return;
        const [scroll, content] = page();
        content.append(label('An invite lets one new node join, works once, and expires after 30 minutes.'));
        const options = new Adw.PreferencesGroup({title: 'Permissions',
            description: 'Every member can use the network and leave. Permissions never change: ' +
                'to change them, the member must leave and join again.'});
        const permission = (title: string, subtitle: string): CheckButton => {
            const check = new Gtk.CheckButton({active: true, valign: Gtk.Align.CENTER});
            const row = new Adw.ActionRow({title, subtitle, activatable_widget: check});
            row.add_prefix(check);
            options.add(row);
            return check;
        };
        const admin = permission('Admin', 'Invite, remove, approve and change settings.');
        const vote = permission('Voter', 'Be an acceptor, and take joins to the network.');
        const relay = permission('Relay', 'Relay messages for other members.');
        content.append(options);
        // The token is long. It scrolls in its own box, so the window does not need to.
        const token = new Gtk.TextView({editable: false, cursor_visible: false, monospace: true,
            wrap_mode: Gtk.WrapMode.CHAR, top_margin: 6, bottom_margin: 6, left_margin: 6, right_margin: 6});
        token.set_tooltip_text('Invite token');
        const tokenScroll = new Gtk.ScrolledWindow({vexpand: true, min_content_height: 120,
            hscrollbar_policy: Gtk.PolicyType.NEVER});
        tokenScroll.set_child(token);
        tokenScroll.add_css_class('frame');
        tokenScroll.set_visible(false);
        content.append(tokenScroll);
        const remaining = label('');
        content.append(remaining);
        const create = button('Create Invite', async () => {
            await this.run(create, async () => {
                this.invite = await call('invite', {permissions: {
                    admin: admin.get_active(), vote: vote.get_active(), relay: relay.get_active(),
                }}, this.cancellable);
                if (this.cancellable.is_cancelled())
                    return '';
                token.get_buffer().set_text(this.invite.token, -1);
                tokenScroll.set_visible(true);
                create.set_label('Create Another');
                copy.set_sensitive(true);
                this.updateCountdown(remaining);
                if (!this.countdown)
                    this.countdown = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
                        this.updateCountdown(remaining);
                        return GLib.SOURCE_CONTINUE;
                    });
                return 'Invite created.';
            });
        });
        content.append(create);
        const copy = button('Copy', () => this.copy(this.invite?.token ?? null));
        copy.set_sensitive(false);
        content.append(copy);
        this.setBody(scroll);
    }

    updateCountdown(widget: Label): void {
        if (!this.invite)
            return;
        const seconds = Math.max(0, Math.ceil((this.invite.expires_at_ms - Date.now()) / 1000));
        widget.set_text(seconds ? `Expires in ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : 'Expired');
    }

    showApprovals(proposals: Proposal[]): void {
        if (!this.approvalContent) {
            const [scroll, content] = page();
            this.approvalContent = content;
            this.setBody(scroll);
        }
        const content = this.approvalContent;
        const ids = JSON.stringify(proposals.map(proposal => proposal.id));
        if (ids !== this.approvalIds) {
            this.approvalIds = ids;
            this.approvalFields.clear();
            let child: Widget | null;
            while ((child = content.get_first_child()))
                content.remove(child);
            if (!proposals.length)
                content.append(label('Nothing waits for approval.'));
        }
        for (const proposal of proposals) {
            const existing = this.approvalFields.get(proposal.id);
            if (existing) {
                existing.count.set_text(`${proposal.approvals.length} of ${proposal.needed}`);
                existing.time.set_text(`${proposal.expires_in_secs}s`);
                continue;
            }
            const name = proposal.name || shortId(proposal.node);
            const heading = proposal.kind === 'join' ? `Join of ${name}` :
                proposal.kind === 'remove' ? `Removal of ${name}` :
                `Setting ${proposal.setting?.key} = ${proposal.setting?.value}`;
            const card = box(8);
            card.add_css_class('card');
            card.append(label(heading, 'title-4'));
            row(card, 'Requested by', shortId(proposal.proposer));
            const count = row(card, 'Approvals', `${proposal.approvals.length} of ${proposal.needed}`).value;
            const time = row(card, 'Time left', `${proposal.expires_in_secs}s`).value;
            this.approvalFields.set(proposal.id, {count, time});
            if (proposal.kind === 'join') {
                if (proposal.permissions)
                    row(card, 'Permissions', permissionNames(proposal.permissions), HELP.permissions);
                row(card, 'Check this ID', `${proposal.node}\nCheck it against the joining node.`);
            }
            const actions = box(8, Gtk.Orientation.HORIZONTAL);
            for (const [text, cmd] of [['Reject', 'reject'], ['Approve', 'approve']] as const)
                actions.append(button(text, async () => {
                    await this.run(actions, async () => changeMessage(await call(cmd,
                        {proposal: proposal.id}, this.cancellable), name));
                    await this.refresh();
                }));
            card.append(actions);
            content.append(card);
        }
    }

    showJoin(): void {
        if (this.body)
            return;
        const [scroll, content] = page();
        content.append(label('Paste the token from Peers > Invite on a member.'));
        const entry = new Gtk.TextView({wrap_mode: Gtk.WrapMode.CHAR, vexpand: true});
        entry.set_tooltip_text('Invite token');
        content.append(entry);
        const join = button('Join', async () => {
            if (await this.run(join, async () => {
                const buffer = entry.get_buffer();
                const token = buffer.get_text(buffer.get_start_iter(), buffer.get_end_iter(), false).trim();
                await call('join', {token}, this.cancellable);
                return '';
            }))
                this.replace('status');
        });
        content.append(join);
        this.setBody(scroll);
    }

    showCreate(): void {
        if (this.body)
            return;
        const [scroll, content] = page();
        content.append(label("This computer becomes the network's first member."));
        const settings = new Adw.PreferencesGroup();
        const range = new Adw.EntryRow({title: 'IPv4 range (optional)'});
        range.set_tooltip_text('A random /24 in 100.64.0.0/10 by default.');
        settings.add(range);
        const strict = new Adw.SwitchRow({title: 'Strict security',
            subtitle: 'Keep Byzantine protection once there are enough members, and pause changes instead of giving it up.'});
        settings.add(strict);
        content.append(settings);
        const create = button('Create', async () => {
            if (await this.run(create, async () => {
                const args: {strict_security: boolean; ipv4_range?: string} = {strict_security: strict.get_active()};
                if (range.get_text().trim())
                    args.ipv4_range = range.get_text().trim();
                await call('init', args, this.cancellable);
                return '';
            }))
                this.replace('status');
        });
        content.append(create);
        this.setBody(scroll);
    }

    showLeave(cancelJoin: boolean): void {
        if (this.body)
            return;
        const [scroll, content] = page();
        content.append(label(cancelJoin ? 'Cancel the join on this computer only. A member may still need to reject the request.' :
            'Retry leaving the network.'));
        content.append(button(cancelJoin ? 'Cancel Join…' : 'Retry Leave…', async () => {
            if (await confirm(this.window, cancelJoin ? 'Cancel the join?' : 'Leave the network?',
                cancelJoin ? 'A member may still need to reject the request.' : 'This computer leaves and removes its WireGuard interface.',
                cancelJoin ? 'Cancel Join' : 'Leave', cancelJoin ? 'Keep Waiting' : 'Cancel') &&
                !this.cancellable.is_cancelled())
                await this.leave(false, cancelJoin);
        }));
        this.setBody(scroll);
    }

    async leave(force: boolean, cancelJoin = false): Promise<void> {
        if (this.busy || this.cancellable.is_cancelled())
            return;
        const control = this.body;
        if (!control)
            return;
        const ok = await this.run(control, async () => {
            if (cancelJoin) {
                const status = await call('status', {}, this.cancellable);
                if (status.phase !== 'pending')
                    throw new Error('This computer is no longer waiting for approval. Check Status before leaving the network.');
            }
            const result = await call('leave', {force}, this.cancellable);
            return result.outcome === 'join_cancelled' ? 'Join cancelled on this computer.' :
                result.problems?.length ? `Left with problems: ${result.problems.join('; ')}` : 'Left the network.';
        });
        if (!ok && !force && !cancelJoin && !this.cancellable.is_cancelled() &&
            await confirm(this.window, 'A step of leaving failed.',
                `${this.notice.get_text()}\n\nLeave anyway? Other members may need repair.`, 'Leave Anyway') &&
            !this.cancellable.is_cancelled())
            await this.leave(true);
    }

    async showLogs(): Promise<void> {
        const [scroll, content] = page();
        content.append(label('Recent daemon log entries', 'title-4'));
        const process = Gio.Subprocess.new(['journalctl', '-u', 'cheesecloth.service', '-n', '100', '--no-pager'],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
        this.logsProcess = process;
        try {
            const [ok, stdout, stderr] = await new Promise<[boolean, string, string]>((resolve, reject) => {
                process.communicate_utf8_async(null, this.cancellable, (source, result) => {
                    try {
                        resolve(source.communicate_utf8_finish(result));
                    } catch (error) {
                        reject(error);
                    }
                });
            });
            if (!this.cancellable.is_cancelled()) {
                content.append(label(ok && process.get_successful() ? stdout : stderr));
                this.setBody(scroll);
            }
        } finally {
            this.logsProcess = null;
        }
    }
}

app.connect('activate', () => {
    const pages: PageKind[] = ['status', 'peers', 'approvals', 'invite', 'join', 'create', 'cancel', 'retry', 'logs'];
    const requested = ARGV[0] as PageKind;
    new Window(pages.includes(requested) ? requested : 'status');
});
app.run([GLib.get_prgname() || 'cheesecloth']);
