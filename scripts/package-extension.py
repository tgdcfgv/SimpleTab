"""Build a clean Edge upload ZIP without repository files or personal data."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json
root = Path(__file__).resolve().parent.parent
manifest = json.loads((root / 'manifest.json').read_text())
paths = [root / name for name in ('manifest.json', 'newtab.html', 'privacy.html', 'install.html')]
for folder in ('css', 'js', 'icons'):
    paths.extend(p for p in (root / folder).rglob('*') if p.is_file() and not p.name.startswith('.'))
for icon in manifest['icons'].values():
    assert (root / icon).is_file(), icon
assert not manifest.get('host_permissions'), 'Unexpected host permissions'
output = root / 'dist' / f"SimTab-{manifest['version']}-edge.zip"
output.parent.mkdir(exist_ok=True)
with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
    for path in sorted(paths):
        archive.write(path, path.relative_to(root))
print(output)
