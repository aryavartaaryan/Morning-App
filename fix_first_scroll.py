import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # The missing closing tag is before:
    #             {/* Close button */}
    #             <TouchableOpacity
    #               onPress={onClose}
    #               activeOpacity={0.8}
    #               style={{ marginTop: 28, borderRadius: 99, paddingVertical: 14, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}
    #             >
    #               <Text style={{ fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.6)', letterSpacing: 1.5 }}>CLOSE</Text>
    #             </TouchableOpacity>
    #   
    #         </View>
    
    # Let's insert it before the closing </View> for that Modal.
    target = """            </TouchableOpacity>
  
        </View>"""
        
    replacement = """            </TouchableOpacity>
          </ScrollView>
        </View>"""
    
    if target in content:
        content = content.replace(target, replacement, 1) # Only replace first occurrence just in case
        with open(file_path, 'w') as f:
            f.write(content)
        print("Restored first ScrollView closing tag.")
    else:
        print("Target block not found.")

if __name__ == "__main__":
    main()
