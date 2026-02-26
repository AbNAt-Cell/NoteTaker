const fs = require('fs');
const path = require('path');

function copyFolderRecursiveSync(source, target) {
    let files = [];

    // Check if folder needs to be created or integrated
    const targetFolder = path.join(target, path.basename(source));
    if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder);
    }

    // Copy
    if (fs.lstatSync(source).isDirectory()) {
        files = fs.readdirSync(source);
        files.forEach(function (file) {
            const curSource = path.join(source, file);
            if (fs.lstatSync(curSource).isDirectory()) {
                copyFolderRecursiveSync(curSource, targetFolder);
            } else {
                fs.copyFileSync(curSource, path.join(targetFolder, file));
            }
        });
    }
}

const basePath = 'c:\\Users\\Keyna\\notetaker\\NoteTaker';
const srcDirs = ['admin', 'settings', 'tracker'];

srcDirs.forEach(dir => {
    console.log(`Copying ${dir}...`);
    copyFolderRecursiveSync(
        path.join(basePath, 'vexa-dashboard', 'src', 'app', dir),
        path.join(basePath, 'apps', 'web', 'src', 'app', 'dashboard')
    );
});

console.log('Copy complete!');
