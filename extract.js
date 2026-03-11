const fs = require('fs');
const html = fs.readFileSync('c:\\Users\\Pedro\\OneDrive\\Escritorio\\Proyectos_Antigravity\\CRM_SWAT_Squad\\App.html', 'utf8');
const match = html.match(/<script>([\s\S]*?)<\/script>/);
if (match) {
    fs.writeFileSync('temp_script.js', match[1]);
    console.log('Extracted script to temp_script.js');
} else {
    console.log('No script tag found');
}
