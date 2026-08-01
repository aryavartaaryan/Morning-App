import os

def add_backhandler(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    if 'import { BackHandler } from' not in content and ' BackHandler' not in content[:1000]:
        content = content.replace("from 'react-native';", ", BackHandler } from 'react-native';")
    
    with open(filepath, 'w') as f:
        f.write(content)

add_backhandler('app/(tabs)/alarms.tsx')
add_backhandler('app/(tabs)/walk.tsx')
