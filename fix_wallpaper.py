import os
import re

wp_file = 'app/wallpaper.tsx'
with open(wp_file, 'r') as f:
    content = f.read()

# 1. Imports
if 'BackHandler' not in content:
    content = re.sub(r'\}\s*from\s*[\'"]react-native[\'"];', r', BackHandler } from "react-native";', content)

if 'useFocusEffect' not in content:
    content = re.sub(r'\}\s*from\s*[\'"]expo-router[\'"];', r', useFocusEffect } from "expo-router";', content)
    
if 'useCallback' not in content:
    content = re.sub(r'import\s+React\s*,\s*\{\s*', r'import React, { useCallback, ', content)

# 2. Inject BackHandler
if 'BackHandler.addEventListener' not in content:
    match = re.search(r'export default function WallpaperSettings\(\)\s*\{\s*const router = useRouter\(\);', content)
    if match:
        insert_pos = match.end()
        snippet = """
  useFocusEffect(useCallback(() => {
    const onBackPress = () => {
      router.navigate('/');
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [router]));
"""
        content = content[:insert_pos] + snippet + content[insert_pos:]

# 3. Change UI back button
content = content.replace("router.back();", "router.navigate('/');")

# 4. Slim styles
old_headerTitle = """  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    letterSpacing: 0.3,
  },"""
new_headerTitle = """  headerTitle: {
    fontSize: 20,
    fontWeight: '300',
    color: '#fff',
    letterSpacing: 1.5,
  },"""
content = content.replace(old_headerTitle, new_headerTitle)

old_headerSubtitle = """  headerSubtitle: {
    fontSize: 10,
    color: '#FFFFFF80',
    marginBottom: 2,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },"""
new_headerSubtitle = """  headerSubtitle: {
    fontSize: 9,
    color: '#FFFFFF80',
    marginBottom: 2,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },"""
content = content.replace(old_headerSubtitle, new_headerSubtitle)

old_heroTime = """  heroTime: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },"""
new_heroTime = """  heroTime: {
    fontSize: 9,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 3,
    marginBottom: 8,
    textTransform: 'uppercase',
  },"""
content = content.replace(old_heroTime, new_heroTime)

old_heroName = """  heroName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },"""
new_heroName = """  heroName: {
    fontSize: 24,
    fontWeight: '300',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },"""
content = content.replace(old_heroName, new_heroName)

old_heroSub = """  heroSub: {
    fontSize: 11,
    color: '#FFFFFF99',
    marginTop: 4,
    fontWeight: '400',
    textAlign: 'center',
    letterSpacing: 0.3,
  },"""
new_heroSub = """  heroSub: {
    fontSize: 11,
    color: '#FFFFFF99',
    marginTop: 4,
    fontWeight: '300',
    textAlign: 'center',
    letterSpacing: 0.5,
  },"""
content = content.replace(old_heroSub, new_heroSub)

old_segmentText = """  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF80',
    letterSpacing: 0.3,
  },"""
new_segmentText = """  segmentText: {
    fontSize: 12,
    fontWeight: '400',
    color: '#FFFFFF80',
    letterSpacing: 0.5,
  },"""
content = content.replace(old_segmentText, new_segmentText)

old_timePillText = """  timePillText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },"""
new_timePillText = """  timePillText: {
    fontSize: 9,
    fontWeight: '500',
    color: '#fff',
    letterSpacing: 1,
  },"""
content = content.replace(old_timePillText, new_timePillText)

old_itemTitle = """  itemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 3,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },"""
new_itemTitle = """  itemTitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#fff',
    marginBottom: 3,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },"""
content = content.replace(old_itemTitle, new_itemTitle)

old_itemSub = """  itemSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },"""
new_itemSub = """  itemSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '400',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },"""
content = content.replace(old_itemSub, new_itemSub)


with open(wp_file, 'w') as f:
    f.write(content)

print("Done tweaking wallpaper.tsx")
