import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Add BackHandler to imports if missing
    if 'BackHandler' not in content:
        content = re.sub(r'import {([^}]+)} from \'react-native\';', r"import {\1, BackHandler} from 'react-native';", content)

    # In walk.tsx, the useFocusEffect is:
    # useFocusEffect(useCallback(() => {
    #   if (flatRef.current) ...
    #
    if filepath.endswith('walk.tsx'):
        # Check if BackHandler is already implemented
        if 'BackHandler.addEventListener' not in content:
            new_effect = """useFocusEffect(useCallback(() => {
    const onBackPress = () => {
      router.navigate('/(tabs)');
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
"""
            content = content.replace("useFocusEffect(useCallback(() => {", new_effect)
            # Find the return () => of that useFocusEffect to add sub.remove()
            # In walk.tsx, there might not be a return. We will just use replace:
            # Let's verify walk.tsx useFocusEffect first... it's safer to just replace `useFocusEffect(useCallback(() => {` and `}, []));`
            # Wait, let's just do a basic string insert for walk.tsx
            pass

    with open(filepath, 'w') as f:
        f.write(content)
    print(f"Processed {filepath}")

# For now, I will use replace_file_content for precision since AST is safer.
