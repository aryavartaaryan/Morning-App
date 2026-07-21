#!/bin/bash
SRC="assets/icon.png"
RES="android/app/src/main/res"

update_density() {
  local dir=$1
  local launcher_size=$2
  local fg_size=$3
  
  rm -f "$RES/$dir/ic_launcher.webp" "$RES/$dir/ic_launcher.png"
  rm -f "$RES/$dir/ic_launcher_round.webp" "$RES/$dir/ic_launcher_round.png"
  rm -f "$RES/$dir/ic_launcher_foreground.webp" "$RES/$dir/ic_launcher_foreground.png"

  sips -z $launcher_size $launcher_size "$SRC" --out "$RES/$dir/ic_launcher.png"
  sips -z $launcher_size $launcher_size "$SRC" --out "$RES/$dir/ic_launcher_round.png"
  sips -z $fg_size $fg_size "$SRC" --out "$RES/$dir/ic_launcher_foreground.png"
}

update_density "mipmap-mdpi" 48 108
update_density "mipmap-hdpi" 72 162
update_density "mipmap-xhdpi" 96 216
update_density "mipmap-xxhdpi" 144 324
update_density "mipmap-xxxhdpi" 192 432
