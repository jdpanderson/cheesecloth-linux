// Interfaces for the GNOME APIs used by this extension.
declare module 'gi://GObject' {
    export class GType {}
    export class ParamSpec {
        static jsobject(name: string, nick: string, blurb: string, flags: number): ParamSpec;
    }
    export class Object {
        static $gtype: GType;
        connect(signal: string, callback: () => void): number;
        disconnect(id: number): void;
        notify(name: string): void;
    }
    export function registerClass<T extends abstract new () => Object>(
        meta: {GTypeName?: string; Properties?: Record<string, ParamSpec>}, klass: T): T;
    export const ParamFlags: {READWRITE: number};
    const GObject: {
        Object: typeof Object; ParamSpec: typeof ParamSpec; ParamFlags: typeof ParamFlags;
        registerClass: typeof registerClass;
    };
    export default GObject;
}

declare module 'gi://Gio' {
    import type {GType, Object as GObject} from 'gi://GObject';
    export interface AsyncResult {}
    export class Cancellable {
        cancel(): void;
        is_cancelled(): boolean;
    }
    export class UnixSocketAddress {
        static new(path: string): UnixSocketAddress;
    }
    export class InputStream {}
    export class OutputStream {
        write_all_async(bytes: Uint8Array, priority: number, cancellable: Cancellable | null,
            callback: (source: OutputStream, result: AsyncResult) => void): void;
        write_all_finish(result: AsyncResult): [boolean, number];
    }
    export class SocketConnection {
        get_input_stream(): InputStream;
        get_output_stream(): OutputStream;
        close(cancellable: Cancellable | null): boolean;
    }
    export class SocketClient {
        set_timeout(seconds: number): void;
        connect_async(address: UnixSocketAddress, cancellable: Cancellable | null,
            callback: (source: SocketClient, result: AsyncResult) => void): void;
        connect_finish(result: AsyncResult): SocketConnection;
    }
    export class DataInputStream {
        constructor(properties: {base_stream: InputStream});
        read_line_async(priority: number, cancellable: Cancellable | null,
            callback: (source: DataInputStream, result: AsyncResult) => void): void;
        read_line_finish_utf8(result: AsyncResult): [string | null, number];
    }
    export class Subprocess {
        static new(argv: string[], flags: number): Subprocess;
        communicate_utf8_async(stdin: string | null, cancellable: Cancellable | null,
            callback: (source: Subprocess, result: AsyncResult) => void): void;
        communicate_utf8_finish(result: AsyncResult): [boolean, string, string];
        get_successful(): boolean;
        force_exit(): void;
    }
    export class ListStore {
        constructor(properties: {item_type: GType});
        get_n_items(): number;
        splice(position: number, removals: number, additions: GObject[]): void;
    }
    export interface Icon {}
    export function icon_new_for_string(name: string): Icon;
    export const ApplicationFlags: {NON_UNIQUE: number};
    export const SubprocessFlags: {NONE: number; STDOUT_PIPE: number; STDERR_PIPE: number};
    const Gio: {
        Cancellable: typeof Cancellable; UnixSocketAddress: typeof UnixSocketAddress;
        SocketClient: typeof SocketClient; DataInputStream: typeof DataInputStream;
        Subprocess: typeof Subprocess; ApplicationFlags: typeof ApplicationFlags;
        SubprocessFlags: typeof SubprocessFlags; ListStore: typeof ListStore;
        icon_new_for_string: typeof icon_new_for_string;
    };
    export default Gio;
}

declare module 'gi://GLib' {
    export function getenv(name: string): string | null;
    export function get_prgname(): string | null;
    export function timeout_add_seconds(priority: number, interval: number, callback: () => boolean): number;
    export function source_remove(id: number): boolean;
    export const PRIORITY_DEFAULT: number;
    export const SOURCE_CONTINUE: boolean;
    const GLib: {
        getenv: typeof getenv; get_prgname: typeof get_prgname;
        timeout_add_seconds: typeof timeout_add_seconds; source_remove: typeof source_remove;
        PRIORITY_DEFAULT: number; SOURCE_CONTINUE: boolean;
    };
    export default GLib;
}

declare module 'gi://Gdk?version=4.0' {
    export class Display {
        static get_default(): Display | null;
    }
    const Gdk: {Display: typeof Display};
    export default Gdk;
}

declare module 'gi://Pango' {
    enum EllipsizeMode { NONE, START, MIDDLE, END }
    const Pango: {EllipsizeMode: typeof EllipsizeMode};
    export default Pango;
}

declare module 'gi://Gtk?version=4.0' {
    import type {Display} from 'gi://Gdk?version=4.0';
    import type {ListStore} from 'gi://Gio';
    import type {Object as GObject} from 'gi://GObject';
    export class Widget {
        add_css_class(name: string): void;
        remove_css_class(name: string): void;
        set_sensitive(value: boolean): void;
        set_visible(value: boolean): void;
        set_hexpand(value: boolean): void;
        set_margin_top(value: number): void;
        set_margin_bottom(value: number): void;
        set_margin_start(value: number): void;
        set_margin_end(value: number): void;
        set_size_request(width: number, height: number): void;
        set_tooltip_text(text: string): void;
        get_first_child(): Widget | null;
        get_root(): Window | null;
    }
    export class Label extends Widget {
        constructor(properties?: {label?: string; xalign?: number; wrap?: boolean; selectable?: boolean; ellipsize?: number});
        set_text(text: string): void;
        get_text(): string;
        set_wrap(value: boolean): void;
        set_ellipsize(mode: number): void;
    }
    export class Box extends Widget {
        constructor(properties?: {orientation?: number; spacing?: number});
        append(child: Widget): void;
        remove(child: Widget): void;
    }
    export class Button extends Widget {
        constructor(properties?: {label?: string; icon_name?: string});
        connect(signal: 'clicked', callback: () => void): number;
        set_label(text: string): void;
        set_child(child: Widget): void;
    }
    export class MenuButton extends Widget {
        constructor(properties?: {icon_name?: string; popover?: Popover});
    }
    export class Popover extends Widget {
        set_child(child: Widget): void;
        popdown(): void;
    }
    export class ScrolledWindow extends Widget {
        constructor(properties?: {hexpand?: boolean; vexpand?: boolean});
        set_child(child: Widget): void;
    }
    export class HeaderBar extends Widget {
        set_title_widget(child: Widget): void;
    }
    export class Stack extends Widget {
        constructor(properties?: {hexpand?: boolean; vexpand?: boolean});
        add_titled(child: Widget, name: string, title: string): void;
        set_visible_child_name(name: string): void;
        get_visible_child_name(): string | null;
    }
    export class Separator extends Widget {
        constructor(properties?: {orientation?: number});
    }
    export class Grid extends Widget {
        constructor(properties?: Record<string, unknown>);
        attach(child: Widget, column: number, row: number, width: number, height: number): void;
        remove(child: Widget): void;
    }
    export class TextBuffer {
        get_start_iter(): unknown;
        get_end_iter(): unknown;
        get_text(start: unknown, end: unknown, include_hidden: boolean): string;
    }
    export class TextView extends Widget {
        constructor(properties?: {wrap_mode?: number; vexpand?: boolean});
        get_buffer(): TextBuffer;
    }
    export class Entry extends Widget {
        get_text(): string;
    }
    export class Switch extends Widget {
        get_active(): boolean;
    }
    export class Clipboard {
        set_text(text: string): void;
    }
    export class Sorter {
        changed(change: number): void;
    }
    export class CustomSorter extends Sorter {
        static new(compare: (a: GObject, b: GObject) => number): CustomSorter;
    }
    export class SortListModel {
        constructor(properties: {model: ListStore; sorter: Sorter | null});
    }
    export class NoSelection {
        constructor(properties: {model: SortListModel});
    }
    export class ColumnViewCell {
        get_item(): GObject | null;
        get_child(): Widget | null;
        set_child(child: Widget): void;
    }
    export class SignalListItemFactory {
        connect(signal: 'setup' | 'bind' | 'unbind' | 'teardown',
            callback: (factory: SignalListItemFactory, cell: ColumnViewCell) => void): number;
    }
    export class ColumnViewColumn {
        constructor(properties: {title: string; factory: SignalListItemFactory; resizable?: boolean;
            expand?: boolean; sorter?: Sorter});
    }
    export class ColumnView extends Widget {
        append_column(column: ColumnViewColumn): void;
        get_sorter(): Sorter | null;
        set_model(model: NoSelection): void;
    }
    export class Window extends Widget {
        set_child(child: Widget): void;
        present(): void;
        get_clipboard(): Clipboard;
        connect(signal: 'close-request', callback: () => boolean): number;
        close(): void;
    }
    export class ApplicationWindow extends Window {
        constructor(properties?: {application?: Application; title?: string;
            default_width?: number; default_height?: number});
    }
    export class Application {
        constructor(properties?: {application_id?: string; flags?: number});
        connect(signal: 'startup' | 'activate', callback: () => void): number;
        run(argv: string[]): number;
    }
    export class MessageDialog extends Window {
        constructor(properties?: Record<string, unknown>);
        add_button(label: string, response: number): Button;
        connect(signal: 'close-request', callback: () => boolean): number;
        connect(signal: 'response', callback: (dialog: MessageDialog, response: number) => void): number;
        destroy(): void;
    }
    export class CssProvider {
        load_from_string(data: string): void;
    }
    export class StyleContext {
        static add_provider_for_display(display: Display, provider: CssProvider, priority: number): void;
    }
    export const Orientation: {VERTICAL: number; HORIZONTAL: number};
    export const SorterChange: {DIFFERENT: number};
    export const WrapMode: {CHAR: number};
    export const ButtonsType: {CLOSE: number; NONE: number};
    export const ResponseType: {CANCEL: number; OK: number};
    export const STYLE_PROVIDER_PRIORITY_APPLICATION: number;
    const Gtk: {
        Label: typeof Label; Box: typeof Box; Button: typeof Button; MenuButton: typeof MenuButton;
        Popover: typeof Popover; ScrolledWindow: typeof ScrolledWindow; HeaderBar: typeof HeaderBar;
        Stack: typeof Stack; Separator: typeof Separator; Grid: typeof Grid;
        TextView: typeof TextView; Entry: typeof Entry; Switch: typeof Switch;
        ApplicationWindow: typeof ApplicationWindow; Application: typeof Application;
        MessageDialog: typeof MessageDialog; CssProvider: typeof CssProvider; StyleContext: typeof StyleContext;
        Orientation: typeof Orientation; WrapMode: typeof WrapMode; ButtonsType: typeof ButtonsType;
        ResponseType: typeof ResponseType; STYLE_PROVIDER_PRIORITY_APPLICATION: number;
        CustomSorter: typeof CustomSorter; SortListModel: typeof SortListModel; NoSelection: typeof NoSelection;
        SignalListItemFactory: typeof SignalListItemFactory; ColumnViewColumn: typeof ColumnViewColumn;
        ColumnView: typeof ColumnView; SorterChange: typeof SorterChange;
    };
    export default Gtk;
}

declare module 'gi://Adw?version=1' {
    import type {Application as GtkApplication, ApplicationWindow as GtkApplicationWindow,
        HeaderBar as GtkHeaderBar, Widget} from 'gi://Gtk?version=4.0';
    export class Application extends GtkApplication {
        constructor(properties?: {application_id?: string; flags?: number});
    }
    export class ApplicationWindow extends GtkApplicationWindow {
        constructor(properties?: {application?: Application; title?: string;
            default_width?: number; default_height?: number});
        set_content(content: Widget): void;
    }
    export class HeaderBar extends GtkHeaderBar {}
    export class ToolbarView extends Widget {
        add_top_bar(widget: Widget): void;
        set_content(content: Widget): void;
    }
    export class AlertDialog extends Widget {
        constructor(properties?: {heading: string; body: string});
        add_response(id: string, label: string): void;
        set_default_response(id: string): void;
        set_close_response(id: string): void;
        set_response_appearance(id: string, appearance: number): void;
        connect(signal: 'response', callback: (dialog: AlertDialog, response: string) => void): number;
        present(parent: Widget): void;
    }
    export class PreferencesGroup extends Widget {
        add(child: Widget): void;
    }
    export class EntryRow extends Widget {
        constructor(properties?: {title: string});
        get_text(): string;
    }
    export class SwitchRow extends Widget {
        constructor(properties?: {title: string; subtitle: string});
        get_active(): boolean;
    }
    export const ResponseAppearance: {DESTRUCTIVE: number};
    const Adw: {
        Application: typeof Application; ApplicationWindow: typeof ApplicationWindow;
        HeaderBar: typeof HeaderBar; ToolbarView: typeof ToolbarView;
        AlertDialog: typeof AlertDialog; ResponseAppearance: typeof ResponseAppearance;
        PreferencesGroup: typeof PreferencesGroup; EntryRow: typeof EntryRow; SwitchRow: typeof SwitchRow;
    };
    export default Adw;
}

declare module 'gi://St' {
    import type {Icon as GIcon} from 'gi://Gio';
    export class Icon {
        constructor(properties?: {gicon?: GIcon; style_class?: string});
    }
    export class Label {
        set_style(style: string): void;
    }
    const St: {Icon: typeof Icon};
    export default St;
}

declare module 'resource:///org/gnome/shell/ui/main.js' {
    import type {Button} from 'resource:///org/gnome/shell/ui/panelMenu.js';
    export const panel: {addToStatusArea(name: string, button: Button): void};
    export function notify(title: string, message: string): void;
}

declare module 'resource:///org/gnome/shell/ui/panelMenu.js' {
    import type {Icon} from 'gi://St';
    import type {PopupMenuItem, PopupSeparatorMenuItem} from 'resource:///org/gnome/shell/ui/popupMenu.js';
    export class Button {
        constructor(menuAlignment: number, nameText: string);
        menu: {
            connect(signal: 'open-state-changed', callback: (menu: unknown, open: boolean) => void): number;
            removeAll(): void;
            addMenuItem(item: PopupMenuItem | PopupSeparatorMenuItem): void;
            addAction(label: string, callback: () => void, icon?: string): void;
        };
        add_child(child: Icon): void;
        destroy(): void;
    }
}

declare module 'resource:///org/gnome/shell/ui/popupMenu.js' {
    import type {Label} from 'gi://St';
    export class PopupMenuItem {
        constructor(text: string, properties?: {reactive?: boolean});
        label: Label;
    }
    export class PopupSeparatorMenuItem {}
}

declare module 'resource:///org/gnome/shell/extensions/extension.js' {
    export class Extension {
        uuid: string;
        path: string;
    }
}

declare const ARGV: string[];
