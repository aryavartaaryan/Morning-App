import re

with open('app/(tabs)/sleep.tsx', 'r') as f:
    content = f.read()

# Let's see where to inject spinAnim
start_marker = "const externalBreath = useRef(new Animated.Value(0)).current;"
end_marker = "const initialPos = (isActive && !isPaused) ? getPositionMs() : 0;"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

print(content[start_idx:end_idx])

