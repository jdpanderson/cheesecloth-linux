import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Scripting from 'resource:///org/gnome/shell/ui/scripting.js';

export const METRICS = {};

export async function run() {
    await Scripting.waitLeisure();
    const uuid = 'cheesecloth@jdpanderson.ca';
    if (!Main.panel.statusArea[uuid]) {
        await Main.extensionManager.enableExtension(uuid);
        await Scripting.sleep(500);
    }
    const button = Main.panel.statusArea[uuid];
    if (!button)
        throw new Error(`The Cheesecloth indicator did not load: ${Main.extensionManager.lookup(uuid)?.error}`);
    button.menu.open();
    await Scripting.sleep(250);
    if (!button.menu.isOpen)
        throw new Error('The Cheesecloth menu did not open.');
    button.menu.close();
}
