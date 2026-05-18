#!/usr/bin/env bash
# Compress all new sound files to M4A (AAC 128kbps)
# Uses macOS built-in afconvert — NO ffmpeg / Homebrew required.
# Original source files are NEVER deleted.

set -e
DIR="/Users/hotelnamastebharatinn/Desktop/Morning-App/assets/sounds"
cd "$DIR"

echo "🎵  Compressing sound files → M4A 128kbps AAC (macOS afconvert)..."

conv() {
  local INPUT="$1"
  local OUTPUT="$2"
  if [ -f "$OUTPUT" ]; then
    echo "  ✓  Already exists: $OUTPUT — skipping"
    return
  fi
  if [ ! -f "$INPUT" ]; then
    echo "  ⚠  Source not found: $INPUT"
    return
  fi
  /usr/bin/afconvert -f m4af -d aac -b 128000 "$INPUT" "$OUTPUT" \
    && echo "  ✓  $OUTPUT" \
    || echo "  ✗  FAILED: $OUTPUT"
}

# ── SITAR ──────────────────────────────────────────────────────────────────
conv "121068__thirsk__75-space-sitar-2.wav"                                               "space-sitar.m4a"
conv "37715__kaiho__sitar-long.aiff"                                                      "sitar-long.m4a"
conv "330350__cmlooi__mixing-and-transfromation-of-sitar-tabla-and-bell-sounds.wav"       "sitar-tabla-bells.m4a"
conv "273666__amritofficial69__indian-sitar.mp3"                                          "indian-sitar-raga.m4a"
conv "boopul-sitar-mango-summer-healing-raga-432hz-525952.mp3"                            "sitar-summer-raga.m4a"
conv "pixel_perfect_productions-sitar-radiance-446269 (1).mp3"                            "sitar-radiance.m4a"
conv "shidenbeatsmusic-indian-music-with-sitar-tanpura-and-sarangi-74577.mp3"             "sitar-tanpura-sarangi.m4a"
conv "shidenbeatsmusic-sitar-and-tanpura-indian-style-bgm-22000.mp3"                      "sitar-tanpura.m4a"
conv "216060__iskweldog__veena_recording.wav"                                             "veena-classical.m4a"
conv "44231991-sitar-215153.mp3"                                                          "sitar-calm.m4a"
conv "saseendran-raga-kanada-veena-strings-mridangam-391842.mp3"                          "veena-raga.m4a"

# ── FLUTE ──────────────────────────────────────────────────────────────────
conv "218037__robinhood76__04845-andean-flute-short-melody.wav"                           "andean-flute.m4a"
conv "431387__carloscarty__canyon-quena-solo-1.wav"                                       "quena-flute.m4a"
conv "447634__wood_flutes__d5-native-american-style-flute-2.mp3"                          "native-flute.m4a"
conv "463037__carloscarty__native-american-flute-echo-loop-am-131-bpm.wav"                "native-flute-echo.m4a"
conv "464010__carloscarty__amazon-bamboo-flute-loop-am-132-bpm-hq.wav"                    "bamboo-flute.m4a"
conv "474797__carloscarty__kygo-pan-flute-pan-pipe-loop-128-bpm-g.wav"                    "pan-flute.m4a"
conv "669533__sintelv__arabian-flute-and-drums.wav"                                       "arabian-flute.m4a"
conv "713120__dyekho__arabic-flute-04-130bpm.wav"                                         "arabic-flute.m4a"
conv "328857__larryv__flute_fmajscale_oct2.wav"                                           "flute-scale.m4a"
conv "85794__sandyrb__native-flute-figure-05.wav"                                         "forest-flute.m4a"
conv "poshpony-bansuri-flute-406082.mp3"                                                  "bansuri-forest.m4a"
conv "saseendran-bansuri-flute-melody-377945.mp3"                                         "bansuri-melody.m4a"
conv "boopul-indian-bansuri-flute-tarana-raga-music-525950.mp3"                           "bansuri-tarana.m4a"

# ── TABLA ──────────────────────────────────────────────────────────────────
conv "114219__lewk__tabla-beat-3.flac"                                                    "tabla-beat.m4a"
conv "178176__c0mp0s3r__tabla-loop-shuffle-4-bars-105-bpm.wav"                            "tabla-shuffle.m4a"
conv "242591__lezaarth__tabla_loop_4bars_90bpm.wav"                                       "tabla-loop.m4a"
conv "513965__eliasartista__tablajam5.wav"                                                "tabla-jam.m4a"
conv "819801__sycopation__tablas-n-claves-1.wav"                                          "tabla-claves.m4a"

# ── BIRDS ──────────────────────────────────────────────────────────────────
conv "27257__kerri__eagle_feather.mp3"                                                    "eagle-feather.m4a"
conv "364983__jgrzinich__forest-cuckoo-bird.wav"                                          "cuckoo-forest.m4a"
conv "462930__diarchangeli__cuckoo-clock-chimes-12.aiff"                                  "cuckoo-clock.m4a"
conv "517779__samuelgremaud__cuckoo-1.wav"                                                "cuckoo-soft.m4a"
conv "59186__dobroide__20080728peacock.wav"                                               "peacock-wild.m4a"
conv "683346__eqavox__cuckoo-clock.wav"                                                   "cuckoo-chime.m4a"
conv "690626__audiobaaz911__north-india-countryside-birds-chirping.wav"                   "india-countryside-birds.m4a"
conv "735747__brunoauzet__cuckoo-and-other-birds.wav"                                     "cuckoo-birds-forest.m4a"
conv "810711__richwise__peacock-call.wav"                                                  "peacock.m4a"
conv "rzalmanialmani-indian-cuckoo-call-koel-bird-sound-361462.mp3"                       "koel-bird.m4a"

# ── TANPURA ────────────────────────────────────────────────────────────────
conv "boopul-gilded-sacred-tanpura-drone-432hz-healing-525911.mp3"                        "tanpura-sacred-432hz.m4a"
conv "boopul-soft-tanpura-drone-breath-meditation-432hz-525941.mp3"                       "tanpura-breath.m4a"
conv "kalsstockmedia-continuous-looped-tanpura-music-track-364156.mp3"                    "tanpura-loop.m4a"
conv "meditativetiger-ethereal-raga-deep-space-tanpura-drone-435906.mp3"                  "raga-tanpura-drone.m4a"
conv "meditativetiger-mystic-tanpura-waves-393679.mp3"                                    "tanpura-mystic.m4a"
conv "meditativetiger-serene-tanpura-meditation-393698.mp3"                               "tanpura-serene.m4a"

# ── SACRED additions ───────────────────────────────────────────────────────
conv "meditativetiger-tibetan-dreams-393682.mp3"                                          "tibetan-dreams.m4a"
conv "89184__timbre__before-then-after-reincarnation.wav"                                 "reincarnation-tones.m4a"
conv "503254__memnosis__spiritual-journey-around-the-world.wav"                           "spiritual-journey.m4a"

# ── WORLD ──────────────────────────────────────────────────────────────────
conv "110334__tomlija__traditional-eastern-instrument-sargija-improvisation-played-by-boris-todorovic.aiff" "sargija-eastern.m4a"
conv "125980__xserra__tagore-festival-3.wav"                                              "tagore-festival.m4a"
conv "537516__kevp888__cd_vie_001.wav"                                                    "world-ambient.m4a"
conv "255898__anantich__141126-night-jungle-nature-ambiencechiangmai_thailand-cicades-cuckoobird-dogsby-anantichortfsd664cs3e.wav" "night-jungle-chiangmai.m4a"
conv "heaventune-traditional-melody-soft-music-465231.mp3"                                "heaven-tune.m4a"

echo ""
echo "✅  All done! M4A files in $DIR:"
ls -lh *.m4a 2>/dev/null | awk '{print "   "$NF, $5}'
