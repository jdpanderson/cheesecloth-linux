// The fields used by this UI from cheesecloth's local API.

// What a member may do, set by its invite. It never changes.
export interface Permissions {
    admin: boolean;
    vote: boolean;
    relay: boolean;
}

export interface Status {
    phase: 'none' | 'pending' | 'member' | 'stopping';
    name: string;
    node_id: string;
    cluster_id: string | null;
    members: number;
    warnings: string[];
    public: boolean;
    relay: boolean;
    ipv4: string | null;
    ipv6: string | null;
    // Null unless a member.
    permissions: Permissions | null;
    keepalive: number;
    changes_paused: boolean;
    version: number | null;
    acceptors: string[];
    config: number | null;
    security: 'uninitialized' | 'relaxed' | 'protected';
    quorum: number;
    reachable_voters: number;
    strict_security: boolean;
    buffer_nodes: number;
    wg_backend: string | null;
    wg_interface: string;
    wg_port: number;
    control_addr: string | null;
    port_mapping: PortMapping[] | null;
}

export interface PortMapping {
    port: 'wireguard' | 'control';
    mapped: {external: string; method: string} | null;
    error: string | null;
}

export interface Peer {
    node_id: string;
    name: string;
    ipv4: string;
    permissions: Permissions;
    acceptor: boolean;
    relay: boolean;
    this_node: boolean;
    connected: boolean;
    present: boolean;
    path: string;
    path_state: string;
    path_detail: string;
    retry_in_secs: number | null;
    wg_endpoint: string | null;
    handshake_age_secs: number | null;
}

export interface Proposal {
    id: string;
    kind: 'join' | 'remove' | 'setting';
    node: string | null;
    name: string | null;
    // For a join, the new member's permissions. Null for other kinds.
    permissions: Permissions | null;
    setting: {key: string; value: string} | null;
    proposer: string;
    approvals: string[];
    needed: number;
    expires_in_secs: number;
}

export type Change =
    {outcome: 'approved'; remaining: number} |
    {outcome: 'pending' | 'rejected' | 'joined' | 'removed' | 'setting_changed'};

export interface Invite {
    token: string;
    expires_at_ms: number;
}

export type Joined = {joined: true; ipv4: string} | {joined: false; node_id: string};

export interface Created {
    cluster_id: string;
    ipv4_range: string;
}

export type Left = {outcome: 'left'; problems: string[]} | {outcome: 'join_cancelled'};
