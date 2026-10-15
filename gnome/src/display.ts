import type {Change, Permissions, PortMapping, Proposal, Status} from './types.js';

export type Level = 'good' | 'attention' | 'broken' | 'off' | 'info';

export function pathLevel(state: string, thisNode: boolean): Level {
    if (thisNode)
        return 'off';
    switch (state) {
    case 'up': return 'good';
    case 'no_path': return 'broken';
    case 'stale':
    case 'no_handshake':
    case 'waiting_to_punch':
    case 'offer_sent':
    case 'punching':
    case 'waiting_for_removal': return 'attention';
    default: return 'off';
    }
}
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
