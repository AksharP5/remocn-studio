#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
appimage="${1:-}"
if [[ -z "$appimage" ]]; then
  shopt -s nullglob
  bundles=("$repo_dir"/src-tauri/target/release/bundle/appimage/*.AppImage)
  if [[ ${#bundles[@]} -ne 1 ]]; then
    printf 'Pass the path to the AppImage to install.\n' >&2
    exit 1
  fi
  appimage="${bundles[0]}"
fi
if [[ ! -f "$appimage" ]]; then
  printf 'AppImage does not exist: %s\n' "$appimage" >&2
  exit 1
fi

data_dir="${XDG_DATA_HOME:-$HOME/.local/share}"
install_dir="$data_dir/remocn-studio"
bin_dir="$HOME/.local/bin"
app_id="io.github.aksharp5.remocn-studio"
install -d "$install_dir" "$bin_dir" "$data_dir/applications"
install -m 755 "$appimage" "$install_dir/RemocnStudio.AppImage.new"
mv -- "$install_dir/RemocnStudio.AppImage.new" "$install_dir/RemocnStudio.AppImage"
ln -sfn -- "$install_dir/RemocnStudio.AppImage" "$bin_dir/remocn-studio"

for size in 32 128 256; do
  icon="${size}x${size}.png"
  if [[ "$size" -eq 256 ]]; then
    icon="128x128@2x.png"
  fi
  icon_dir="$data_dir/icons/hicolor/${size}x${size}/apps"
  install -d "$icon_dir"
  install -m 644 "$repo_dir/src-tauri/icons/$icon" "$icon_dir/$app_id.png"
done

launcher="${bin_dir//\\/\\\\}/remocn-studio"
launcher="${launcher//\"/\\\"}"
cat > "$data_dir/applications/$app_id.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Remocn Studio
Comment=Create videos with AI as editable Remotion projects
Exec="$launcher" %U
Icon=$app_id
Terminal=false
Categories=AudioVideo;Video;
StartupWMClass=remocn-studio
MimeType=x-scheme-handler/remocn-studio;
EOF

if command -v update-desktop-database >/dev/null; then
  update-desktop-database "$data_dir/applications"
fi
if command -v gtk-update-icon-cache >/dev/null; then
  gtk-update-icon-cache -f -t "$data_dir/icons/hicolor" >/dev/null 2>&1 || true
fi
if command -v xdg-mime >/dev/null; then
  mime_file="${XDG_CONFIG_HOME:-$HOME/.config}/mimeapps.list"
  if [[ -f "$mime_file" && ! -e "$mime_file.remocn-studio-before" ]]; then
    cp -- "$mime_file" "$mime_file.remocn-studio-before"
  fi
  xdg-mime default "$app_id.desktop" x-scheme-handler/remocn-studio
fi
printf 'Installed Remocn Studio. Launch it from your app launcher or %s/remocn-studio\n' "$bin_dir"
