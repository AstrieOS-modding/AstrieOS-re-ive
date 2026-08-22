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