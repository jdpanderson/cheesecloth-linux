export function pathLevel(state, thisNode) {
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
export function menuState(status, proposals = []) {
    switch (status.phase) {
        case 'none':
            return { title: 'Not in a network', detail: status.name, level: 'off', actions: ['create', 'join'] };
        case 'pending':
            return { title: 'Waiting for approval', detail: status.name, level: 'attention', actions: ['status', 'cancel'] };
        case 'stopping':
            return { title: 'Leaving', detail: status.warnings[0] || '', level: 'attention', actions: ['retry', 'logs'] };
        case 'member': {
            const warnings = status.warnings.length;
            return {
                title: warnings ? 'Connected, with warnings' : 'Connected',
                detail: `${status.name} • ${warnings ? `${warnings} warning${warnings === 1 ? '' : 's'}` : `${status.members} member${status.members === 1 ? '' : 's'}`}`,
                level: warnings ? 'attention' : 'good',
                actions: ['status', 'peers', ...(proposals.length ? ['approvals'] : [])],
                approvals: proposals.length,
            };
        }
        default:
            throw new Error(`Unknown phase: ${status.phase}`);
    }
}
export function errorState(error) {
    if (error.kind === 'refused')
        return { title: 'Cheesecloth group only', detail: error.message, level: 'broken', actions: [] };
    if (error.kind === 'version')
        return { title: 'Needs reinstall', detail: error.message, level: 'broken', actions: [] };
    return { title: 'Not responding', detail: error.message, level: 'broken', actions: ['logs'] };
}
export function shortId(id) {
    return id && id.length > 16 ? `${id.slice(0, 12)}…${id.slice(-4)}` : id || '—';
}
export function mapping(status, port) {
    const map = status.port_mapping?.find(item => item.port === port);
    if (!map)
        return ['Off', 'off', 'Port mapping is off.'];
    if (map.mapped)
        return ['Mapped', 'good', `${map.mapped.external} via ${map.mapped.method}`];
    if (map.error)
        return ['Not mapped', 'attention', map.error];
    return ['Requesting', 'off', 'Waiting for a router.'];
}
export function changeMessage(change, name = 'the node') {
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
