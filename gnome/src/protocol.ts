import type {Change, Created, Invite, Joined, Left, Peer, PortMapping, Proposal, Status} from './types.js';

export interface Results {
    status: Status;
    pending: Proposal[];
    peers: Peer[];
    invite: Invite;
    init: Created;
    join: Joined;
    leave: Left;
    remove: Change;
    approve: Change;
    reject: Change;
}

export class ApiError extends Error {
    constructor(
        public readonly kind: 'unreachable' | 'protocol' | 'daemon' | 'refused' | 'version',
        message: string,
        public readonly code: string | null = null,
    ) {
        super(message);
    }
}

function invalid(path: string): never {
    throw new ApiError('protocol', `Unexpected ${path} in the daemon reply.`);
}

function object(value: unknown, path: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        invalid(path);
    return value as Record<string, unknown>;
}

function string(value: unknown, path: string): string {
    if (typeof value !== 'string')
        invalid(path);
    return value;
}

function nullableString(value: unknown, path: string): string | null {
    return value === null ? null : string(value, path);
}

function boolean(value: unknown, path: string): boolean {
    if (typeof value !== 'boolean')
        invalid(path);
    return value;
}

function integer(value: unknown, path: string): number {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
        invalid(path);
    return value;
}

function nullableInteger(value: unknown, path: string): number | null {
    return value === null ? null : integer(value, path);
}

function list<T>(value: unknown, path: string, read: (item: unknown, path: string) => T): T[] {
    if (!Array.isArray(value))
        invalid(path);
    return value.map((item, index) => read(item, `${path}[${index}]`));
}

function choice<T extends string>(value: unknown, path: string, values: readonly T[]): T {
    if (typeof value !== 'string' || !values.includes(value as T))
        invalid(path);
    return value as T;
}

export function decodeEnvelope(value: unknown): unknown {
    const answer = object(value, 'answer');
    if (Object.hasOwn(answer, 'err') && !Object.hasOwn(answer, 'ok')) {
        if (typeof answer.err === 'string')
            throw new ApiError('version', 'The daemon is older than this app. Reinstall cheesecloth.',
                'api_version_mismatch');
        const error = object(answer.err, 'answer.err');
        const code = string(error.code, 'answer.err.code');
        const message = string(error.message, 'answer.err.message');
        throw new ApiError(code === 'permission_denied' ? 'refused' : 'daemon', message, code);
    }
    if (!Object.hasOwn(answer, 'ok') || Object.hasOwn(answer, 'err'))
        invalid('answer');
    return answer.ok;
}

export function validateHello(value: unknown): {api: number; daemon: string} {
    const hello = object(value, 'hello');
    return {api: integer(hello.api, 'hello.api'), daemon: string(hello.daemon, 'hello.daemon')};
}

function portMapping(value: unknown, path: string): PortMapping {
    const map = object(value, path);
    const mapped = map.mapped === null ? null : object(map.mapped, `${path}.mapped`);
    return {
        port: choice(map.port, `${path}.port`, ['wireguard', 'control']),
        mapped: mapped ? {
            external: string(mapped.external, `${path}.mapped.external`),
            method: string(mapped.method, `${path}.mapped.method`),
        } : null,
        error: nullableString(map.error, `${path}.error`),
    };
}

function status(value: unknown): Status {
    const item = object(value, 'status');
    return {
        phase: choice(item.phase, 'status.phase', ['none', 'pending', 'member', 'stopping']),
        name: string(item.name, 'status.name'),
        node_id: string(item.node_id, 'status.node_id'),
        cluster_id: nullableString(item.cluster_id, 'status.cluster_id'),
        members: integer(item.members, 'status.members'),
        warnings: list(item.warnings, 'status.warnings', string),
        public: boolean(item.public, 'status.public'),
        relay: boolean(item.relay, 'status.relay'),
        ipv4: nullableString(item.ipv4, 'status.ipv4'),
        ipv6: nullableString(item.ipv6, 'status.ipv6'),
        keepalive: integer(item.keepalive, 'status.keepalive'),
        changes_paused: boolean(item.changes_paused, 'status.changes_paused'),
        version: nullableInteger(item.version, 'status.version'),
        acceptors: list(item.acceptors, 'status.acceptors', string),
        config: nullableInteger(item.config, 'status.config'),
        security: choice(item.security, 'status.security', ['uninitialized', 'relaxed', 'protected']),
        quorum: integer(item.quorum, 'status.quorum'),
        reachable_voters: integer(item.reachable_voters, 'status.reachable_voters'),
        strict_security: boolean(item.strict_security, 'status.strict_security'),
        buffer_nodes: integer(item.buffer_nodes, 'status.buffer_nodes'),
        wg_backend: nullableString(item.wg_backend, 'status.wg_backend'),
        wg_interface: string(item.wg_interface, 'status.wg_interface'),
        wg_port: integer(item.wg_port, 'status.wg_port'),
        control_addr: nullableString(item.control_addr, 'status.control_addr'),
        port_mapping: item.port_mapping == null ? null :
            list(item.port_mapping, 'status.port_mapping', portMapping),
    };
}

function peer(value: unknown, path: string): Peer {
    const item = object(value, path);
    return {
        node_id: string(item.node_id, `${path}.node_id`),
        name: string(item.name, `${path}.name`),
        ipv4: string(item.ipv4, `${path}.ipv4`),
        acceptor: boolean(item.acceptor, `${path}.acceptor`),
        relay: boolean(item.relay, `${path}.relay`),
        this_node: boolean(item.this_node, `${path}.this_node`),
        connected: boolean(item.connected, `${path}.connected`),
        present: boolean(item.present, `${path}.present`),
        path: choice(item.path, `${path}.path`, ['self', 'lan', 'public', 'await', 'punch', 'none']),
        path_state: string(item.path_state, `${path}.path_state`),
        path_detail: string(item.path_detail, `${path}.path_detail`),
        retry_in_secs: nullableInteger(item.retry_in_secs, `${path}.retry_in_secs`),
        wg_endpoint: nullableString(item.wg_endpoint, `${path}.wg_endpoint`),
        handshake_age_secs: nullableInteger(item.handshake_age_secs, `${path}.handshake_age_secs`),
    };
}

function proposal(value: unknown, path: string): Proposal {
    const item = object(value, path);
    const setting = item.setting === null ? null : object(item.setting, `${path}.setting`);
    return {
        id: string(item.id, `${path}.id`),
        kind: choice(item.kind, `${path}.kind`, ['join', 'remove', 'setting']),
        node: nullableString(item.node, `${path}.node`),
        name: nullableString(item.name, `${path}.name`),
        setting: setting ? {
            key: string(setting.key, `${path}.setting.key`),
            value: string(setting.value, `${path}.setting.value`),
        } : null,
        proposer: string(item.proposer, `${path}.proposer`),
        approvals: list(item.approvals, `${path}.approvals`, string),
        needed: integer(item.needed, `${path}.needed`),
        expires_in_secs: integer(item.expires_in_secs, `${path}.expires_in_secs`),
    };
}

function change(value: unknown): Change {
    const item = object(value, 'change');
    const outcome = choice(item.outcome, 'change.outcome',
        ['pending', 'approved', 'rejected', 'joined', 'removed', 'setting_changed']);
    return outcome === 'approved' ?
        {outcome, remaining: integer(item.remaining, 'change.remaining')} : {outcome};
}

export function validateResult<C extends keyof Results>(cmd: C, value: unknown): Results[C] {
    let result: Results[keyof Results];
    switch (cmd) {
    case 'status': result = status(value); break;
    case 'peers': result = list(value, 'peers', peer); break;
    case 'pending': result = list(value, 'pending', proposal); break;
    case 'invite': {
        const item = object(value, 'invite');
        result = {token: string(item.token, 'invite.token'),
            expires_at_ms: integer(item.expires_at_ms, 'invite.expires_at_ms')};
        break;
    }
    case 'init': {
        const item = object(value, 'init');
        result = {cluster_id: string(item.cluster_id, 'init.cluster_id'),
            ipv4_range: string(item.ipv4_range, 'init.ipv4_range')};
        break;
    }
    case 'join': {
        const item = object(value, 'join');
        const joined = boolean(item.joined, 'join.joined');
        result = joined ? {joined: true, ipv4: string(item.ipv4, 'join.ipv4')} :
            {joined: false, node_id: string(item.node_id, 'join.node_id')};
        break;
    }
    case 'leave': {
        const item = object(value, 'leave');
        const outcome = choice(item.outcome, 'leave.outcome', ['left', 'join_cancelled']);
        result = outcome === 'left' ?
            {outcome, problems: list(item.problems, 'leave.problems', string)} : {outcome};
        break;
    }
    case 'remove':
    case 'approve':
    case 'reject': result = change(value); break;
    default: return invalid('command');
    }
    return result as Results[C];
}
