import type {Change, Peer, Permissions, PortMapping, Proposal, Status} from './types.js';

// `degraded` is between `attention` and `broken`: something worked, and may have stopped.
export type Level = 'good' | 'attention' | 'degraded' | 'broken' | 'off' | 'info';

// A light in the peers table: its color, and a tooltip that names the state and says what it means.
export interface Light {
    level: Level;
    tooltip: string;
}

// The color and meaning of each WireGuard path state. Green: traffic flows. Yellow: the path is being set up.
// Orange: the path worked, but has had no handshake for a while. Red: there is no path.
const PATH_STATES = new Map<string, [Level, string]>([
    ['up', ['good', 'WireGuard had a recent handshake with this member, so traffic flows.']],
    ['not_configured', ['attention', 'WireGuard has no entry for this member yet.']],
    ['no_handshake', ['attention', 'WireGuard has not had a handshake with this member yet.']],
    ['waiting_to_punch', ['attention', 'A NAT hole punch is due, and waits for its turn.']],
    ['offer_sent', ['attention', 'This computer offered a NAT hole punch, and waits for the answer.']],
    ['punching', ['attention', 'Both sides are opening their NATs to reach each other.']],
    ['waiting_for_removal', ['attention', 'The old path is being removed from WireGuard before the next try.']],
    ['stale', ['degraded', 'The last WireGuard handshake was more than 200 seconds ago. The path may be down.']],
    ['no_path', ['broken', 'NAT hole punching failed, so there is no path to this member. It is tried again later.']],
]);

export function pathLight(peer: Pick<Peer, 'path_state' | 'path_detail' | 'this_node'>): Light {
    if (peer.this_node)
        return {level: 'off', tooltip: 'This computer'};
    const detail = peer.path_detail.charAt(0).toUpperCase() + peer.path_detail.slice(1);
    const known = PATH_STATES.get(peer.path_state);
    // A state from a newer daemon has no color here, but its detail still names it.
    return known ? {level: known[0], tooltip: `${detail}\n${known[1]}`} : {level: 'off', tooltip: detail};
}

// Problems first: red, orange, yellow, green, then grey.
export const LEVEL_ORDER: Level[] = ['broken', 'degraded', 'attention', 'good', 'info', 'off'];
export type MenuAction = 'status' | 'peers' | 'approvals' | 'create' | 'join' |
    'cancel' | 'retry' | 'logs';
export interface MenuState {
    title: string;
    detail: string;
    level: Level;
    actions: MenuAction[];
    approvals?: number;
}

// The space between the parts of a menu header line, such as "Cheesecloth  •  Connected".
export const SEPARATOR = '  •  ';

export function menuState(status: Status, proposals: Proposal[] = []): MenuState {
    switch (status.phase) {
    case 'none':
        return {title: 'Not in a network', detail: status.name, level: 'off', actions: ['create', 'join']};
    case 'pending':
        return {title: 'Waiting for approval', detail: status.name, level: 'attention', actions: ['status', 'cancel']};
    case 'stopping':
        return {title: 'Leaving', detail: status.warnings[0] || '', level: 'attention', actions: ['retry', 'logs']};
    case 'member': {
        const warnings = status.warnings.length;
        // Only an admin may approve or reject, so other members get no approvals page.
        const approvals = status.permissions?.admin ? proposals.length : 0;
        return {
            title: warnings ? 'Connected, with warnings' : 'Connected',
            detail: `${status.name}${SEPARATOR}${warnings ? `${warnings} warning${warnings === 1 ? '' : 's'}` : `${status.members} member${status.members === 1 ? '' : 's'}`}`,
            level: warnings ? 'attention' : 'good',
            actions: ['status', 'peers', ...(approvals ? ['approvals' as const] : [])],
            approvals,
        };
    }
    default:
        throw new Error(`Unknown phase: ${status.phase}`);
    }
}

export function errorState(error: {kind?: string; message: string}): MenuState {
    if (error.kind === 'refused')
        return {title: 'Cheesecloth group only', detail: error.message, level: 'broken', actions: []};
    if (error.kind === 'version')
        return {title: 'Needs reinstall', detail: error.message, level: 'broken', actions: []};
    return {title: 'Not responding', detail: error.message, level: 'broken', actions: ['logs']};
}

// A member's permissions for people: "All", a list such as "Voter, Relay", or "Member" with none.
export function permissionNames(permissions: Permissions): string {
    const names = [
        ...(permissions.admin ? ['Admin'] : []),
        ...(permissions.vote ? ['Voter'] : []),
        ...(permissions.relay ? ['Relay'] : []),
    ];
    return names.length === 3 ? 'All' : names.length ? names.join(', ') : 'Member';
}

// An icon in the peers table, with the tooltip that names it. `dim` is for "Member", which has none of the others.
export interface Badge {
    icon: string;
    tooltip: string;
    dim?: boolean;
}

const VOTE_ICON = 'object-select-symbolic';
const RELAY_ICON = 'network-transmit-receive-symbolic';
const MEMBER_ICON = 'avatar-default-symbolic';

// What the member does now. Its permissions say what it may do.
export function roleBadges(peer: Pick<Peer, 'acceptor' | 'relay'>): Badge[] {
    const badges = [
        ...(peer.acceptor ? [{icon: VOTE_ICON, tooltip: 'Acceptor: votes on changes now'}] : []),
        ...(peer.relay ? [{icon: RELAY_ICON, tooltip: 'Relay: relays messages for other members now'}] : []),
    ];
    return badges.length ? badges : [{icon: MEMBER_ICON, tooltip: 'Member: no other role now', dim: true}];
}

export function permissionBadges(permissions: Permissions): Badge[] {
    const badges = [
        ...(permissions.admin ? [{icon: 'security-high-symbolic', tooltip: 'Admin: may invite, remove, approve and change settings'}] : []),
        ...(permissions.vote ? [{icon: VOTE_ICON, tooltip: 'Voter: may be an acceptor, and take joins to the network'}] : []),
        ...(permissions.relay ? [{icon: RELAY_ICON, tooltip: 'Relay: may relay messages for other members'}] : []),
    ];
    return badges.length ? badges : [{icon: MEMBER_ICON, tooltip: 'Member: may use the network and leave', dim: true}];
}

export function shortId(id: string | null | undefined): string {
    return id && id.length > 16 ? `${id.slice(0, 12)}…${id.slice(-4)}` : id || '—';
}

export function mapping(status: Pick<Status, 'port_mapping'>, port: PortMapping['port']): [string, Level, string] {
    const map = status.port_mapping?.find(item => item.port === port);
    if (!map)
        return ['Off', 'off', 'Port mapping is off.'];
    if (map.mapped)
        return ['Mapped', 'good', `${map.mapped.external} via ${map.mapped.method}`];
    if (map.error)
        return ['Not mapped', 'attention', map.error];
    return ['Requesting', 'off', 'Waiting for a router.'];
}

export function changeMessage(change: Change, name = 'the node'): string {
    switch (change.outcome) {
    case 'pending': return 'Waiting for approvals from other members.';
    case 'approved': return `Approved. ${change.remaining} more approval(s) needed.`;
    case 'rejected': return 'Rejected.';
    case 'joined': return `${name} joined.`;
    case 'removed': return `Removed ${name}.`;
    case 'setting_changed': return 'Setting changed.';
    default: throw new Error('Unexpected change outcome.');
    }
}
