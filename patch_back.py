import os

def patch_alarms():
    with open('app/(tabs)/alarms.tsx', 'r') as f:
        content = f.read()
        
    old_effect = """  useFocusEffect(useCallback(() => {
    alarmScrollRef.current?.scrollTo({ y: 0, animated: false });
    return () => {
      stopPreview().catch(() => {});
    };
  }, []));"""
  
    new_effect = """  useFocusEffect(useCallback(() => {
    alarmScrollRef.current?.scrollTo({ y: 0, animated: false });
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.navigate('/(tabs)');
      return true;
    });
    return () => {
      sub.remove();
      stopPreview().catch(() => {});
    };
  }, [router]));"""
  
    content = content.replace(old_effect, new_effect)
    with open('app/(tabs)/alarms.tsx', 'w') as f:
        f.write(content)

def patch_walk():
    with open('app/(tabs)/walk.tsx', 'r') as f:
        content = f.read()
        
    old_effect = """  useFocusEffect(useCallback(() => {
    walkScrollRef.current?.scrollTo({ y: 0, animated: false });
    // Run daily reset check every time the tab is focused
    StepCounter.maybeResetForNewDay().then(() => refreshStats());
  }, [refreshStats]));"""
  
    new_effect = """  useFocusEffect(useCallback(() => {
    walkScrollRef.current?.scrollTo({ y: 0, animated: false });
    // Run daily reset check every time the tab is focused
    StepCounter.maybeResetForNewDay().then(() => refreshStats());
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      router.navigate('/(tabs)');
      return true;
    });
    return () => sub.remove();
  }, [refreshStats, router]));"""
  
    content = content.replace(old_effect, new_effect)
    with open('app/(tabs)/walk.tsx', 'w') as f:
        f.write(content)

patch_alarms()
patch_walk()
print("Done!")
