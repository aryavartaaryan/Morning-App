import sys

def main():
    file_path = 'components/MetabolicStoryModal.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # We want to grab the DO & AVOID PROTOCOLS section and move it up.
    start_proto = "            {/* ════ SECTION: DO & AVOID PROTOCOLS ════ */}"
    end_proto = "            <TouchableOpacity\n              activeOpacity={0.85}"
    
    idx_proto_start = content.find(start_proto)
    idx_proto_end = content.find(end_proto, idx_proto_start)
    
    if idx_proto_start == -1 or idx_proto_end == -1:
        print("Could not find protocols block")
        return
        
    proto_block = content[idx_proto_start:idx_proto_end]
    content = content[:idx_proto_start] + content[idx_proto_end:]
    
    # We want to insert proto_block right after the Dynamic Real-Time Window Card
    insert_target = "            {/* ════ SECTION: THE REAL SCIENCE OF EARTH'S TILT ════ */}"
    idx_insert = content.find(insert_target)
    
    if idx_insert != -1:
        # Before we insert, let's style the proto block to be more compact.
        # It's currently a S.card. Let's keep it that way, but it will now appear high up.
        content = content[:idx_insert] + proto_block + "\n" + content[idx_insert:]
        
    # Let's compress the S.card padding from 24 to 16, and reduce marginBottom
    content = content.replace("padding: 24,", "padding: 18,")
    content = content.replace("marginBottom: 16,", "marginBottom: 12,")
    content = content.replace("paddingHorizontal: 20,", "paddingHorizontal: 16,")
    content = content.replace("fontSize: 28,", "fontSize: 24,")
    
    with open(file_path, 'w') as f:
        f.write(content)
    print("Patched MetabolicStoryModal successfully.")

if __name__ == "__main__":
    main()
