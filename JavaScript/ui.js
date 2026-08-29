let DateinTemplate = null;
let windowTemplateReady = false;
let dateinStylesLoaded = false;

fetch('/ui/Nutzercenter.html')
  .then(res => res.text())
  .then(html => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const template = doc.querySelector('#Nutztercenter-placeholder');
    document.body.appendChild(template.content.cloneNode(true));
  });

fetch('/ui/Einstellungen.html')
    .then(res => res.text())
    .then(html => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const template = doc.querySelector('#einstellungen-placeholder');
        document.body.appendChild(template.content.cloneNode(true));
    });

fetch('/ui/overlay/window.html')
    .then(res => res.text())
    .then(html => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const template = doc.querySelector('#Window-border');
        if (!template) throw new Error('Fenster-Template wurde nicht gefunden.');
        WindowManager.init(template.content);
        windowTemplateReady = true;
    });

fetch('/ui/Datein.html')
    .then(res => res.text())
    .then(html => {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const template = doc.querySelector('#Datein-placeholder');
        if (!template) throw new Error('Datei-Template wurde nicht gefunden.');
        DateinTemplate = template.content;
    });

function openDateinWindow() {
    if (!DateinTemplate || !windowTemplateReady) return;

    if (WindowManager.windows['datein']) {
        const w = WindowManager.windows['datein'];
        if (w.minimized) {
            WindowManager.restoreWindow('datein');
        } else {
            WindowManager.focusWindow('datein');
        }
        return;
    }

    const content = DateinTemplate.cloneNode(true);
    if (!dateinStylesLoaded) {
        const cssLink = document.createElement('link');
        cssLink.rel = 'stylesheet';
        cssLink.href = '/ui/Ui_css/Datein.css';
        document.head.appendChild(cssLink);
        dateinStylesLoaded = true;
    }

    WindowManager.createWindow({
        id: 'datein',
        title: 'Datein',
        icon: '/Res/Bild/Icon/Topbar/folder_24dp_FFFFFF_FILL1_wght400_GRAD0_opsz24.svg',
        content: content
    });
}
