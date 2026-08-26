import os

file_path = "app/(tabs)/sleep.tsx"

with open(file_path, "r") as f:
    content = f.read()

target = """        {/* ── Content container — transparent, swipe handler for category change ── */}
        <FlingGestureHandler
          direction={Directions.LEFT}
          onHandlerStateChange={({ nativeEvent }) => {
            if (nativeEvent.state === State.ACTIVE) {
              const tabIdx = TAB_CATEGORIES.indexOf(selectedCat as any);
              if (tabIdx !== -1) {
                if (tabIdx < TAB_CATEGORIES.length - 1) {
                  changeCategory(TAB_CATEGORIES[tabIdx + 1] as Category, -1);
                } else {
                  changeCategory(TAB_CATEGORIES[0] as Category, -1);
                }
              }
            }
          }}
        >
          <FlingGestureHandler
            direction={Directions.RIGHT}
            onHandlerStateChange={({ nativeEvent }) => {
              if (nativeEvent.state === State.ACTIVE) {
                const tabIdx = TAB_CATEGORIES.indexOf(selectedCat as any);
                if (tabIdx !== -1) {
                  if (tabIdx > 0) {
                    changeCategory(TAB_CATEGORIES[tabIdx - 1] as Category, 1);
                  } else {
                    changeCategory(TAB_CATEGORIES[TAB_CATEGORIES.length - 1] as Category, 1);
                  }
                }
              }
            }}
          >
            <View style={{ backgroundColor: 'transparent', paddingTop: 4 }}>

        {/* Recently Played — shown only after first play */}
        {recentSoundIds.length > 0 && (
          <RecentlyPlayedStrip
            soundIds={recentSoundIds}
            playingId={playingId}
            isPaused={isPaused}
            onPress={handleSoundCardTap}
            isExpanded={isRecentExpanded}
            onToggleExpand={() => setIsRecentExpanded(!isRecentExpanded)}
          />
        )}

        <SonicCollections onSelectCollection={setActiveCollectionId} />

        </View>{/* end lifted container */}
          </FlingGestureHandler>
        </FlingGestureHandler>"""

replacement = """        {/* ── Content container ── */}
        <View style={{ backgroundColor: 'transparent', paddingTop: 4 }}>
          {/* Recently Played — shown only after first play */}
          {recentSoundIds.length > 0 && (
            <RecentlyPlayedStrip
              soundIds={recentSoundIds}
              playingId={playingId}
              isPaused={isPaused}
              onPress={handleSoundCardTap}
              isExpanded={isRecentExpanded}
              onToggleExpand={() => setIsRecentExpanded(!isRecentExpanded)}
            />
          )}

          <SonicCollections onSelectCollection={setActiveCollectionId} />
        </View>"""

if target in content:
    new_content = content.replace(target, replacement)
    with open(file_path, "w") as f:
        f.write(new_content)
    print("Replaced successfully!")
else:
    print("Target not found.")

