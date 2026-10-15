import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';

export const METRICS = {};

export async function run() {
    await Scripting.waitLeisure();
    const uuid = 'cheesecloth-gnome@janderson.ca';
    if (!Main.panel.statusArea[uuid]) {
        await Main.extensionManager.enableExtension(uuid);
        await Scripting.sleep(500);
    }
    const button = Main.panel.statusArea[uuid];
    if (!button)
        throw new Error(`The Cheesecloth indicator did not load: ${Main.extensionManager.lookup(uuid)?.error}`);
    const icon = button.get_children().find(child => child instanceof St.Icon);
    const file = icon?.gicon?.get_file?.();
    if (!file?.query_exists(null))
        throw new Error(`The Cheesecloth icon file is missing: ${file?.get_path() ?? 'no file icon'}`);
    button.menu.open();
    await Scripting.sleep(250);
    if (!button.menu.isOpen)
        throw new Error('The Cheesecloth menu did not open.');
    button.menu.close();
}
