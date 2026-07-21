#!/bin/bash
SRC="assets/splash-icon.png"
RES="android/app/src/main/res"

update_splash() {
  local density=$1
  local size=$2
  
  if [ -d "$RES/drawable-$density" ]; then
    sips -z $size $size "$SRC" --out "$RES/drawable-$density/splashscreen_logo.png"
  fi
  if [ -d "$RES/drawable-night-$density" ]; then
    sips -z $size $size "$SRC" --out "$RES/drawable-night-$density/splashscreen_logo.png"
  fi
}

update_splash "mdpi" 288
update_splash "hdpi" 432
update_splash "xhdpi" 576
update_splash "xxhdpi" 864
update_splash "xxxhdpi" 1152
