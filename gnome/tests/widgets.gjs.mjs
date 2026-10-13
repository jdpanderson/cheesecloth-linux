import Adw from 'gi://Adw?version=1';
import Gio from 'gi://Gio';

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
window.close();
