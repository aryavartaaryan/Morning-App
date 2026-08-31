import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    target = """              </View>
            </View>
          )}
        </View>
      </SafeAreaView>"""
      
    replacement = """              </View>
            </View>
      </SafeAreaView>"""
      
    if target not in content:
        print("Target not found!")
        sys.exit(1)
        
    content = content.replace(target, replacement)
    
    with open(file_path, 'w') as f:
        f.write(content)
        
    print("Patched Syntax error successfully!")

if __name__ == '__main__':
    main()
