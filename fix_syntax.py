import sys

def main():
    file_path = 'app/(tabs)/index.tsx'
    with open(file_path, 'r') as f:
        content = f.read()

    # Find where the Almanac tab renders.
    # It probably starts with `function AlmanacTab()` or similar.
    # Actually, the error is an adjacent JSX element.
    # The return statement probably looks like:
    # return (
    #   <View style={{ flex: 1, ... }}>
    #     ...
    #   </View>
    #   {showCalendar && <VedicCalendarModal ... />}
    # )
    
    # We can just look for the exact string:
    target_block = """          </TouchableOpacity>
        </View>
      </View>

      {showCalendar && <VedicCalendarModal onClose={() => setShowCalendar(false)} userLat={weather?.lat} userLon={weather?.lon} />}

      {/* ── Panchanga Detail Modal ── */}"""

    if target_block in content:
        # It's an adjacent JSX issue. But where is the opening tag?
        # Let's just wrap the whole return statement of that component.
        pass

    # Instead of parsing, let's just use regex to find the component.
    import re
    # We will wrap the `{showCalendar ... }` inside the preceding View.
    old_code = """          </TouchableOpacity>
        </View>
      </View>

      {showCalendar && <VedicCalendarModal onClose={() => setShowCalendar(false)} userLat={weather?.lat} userLon={weather?.lon} />}"""

    new_code = """          </TouchableOpacity>
        </View>

        {showCalendar && <VedicCalendarModal onClose={() => setShowCalendar(false)} userLat={weather?.lat} userLon={weather?.lon} />}
      </View>"""
      
    content = content.replace(old_code, new_code)
    
    # Also for the modal below it
    old_modal = """      {/* ── Panchanga Detail Modal ── */}
      <Modal visible={!!panchangaDetail} transparent animationType="slide" onRequestClose={() => setPanchangaDetail(null)}>"""
      
    new_modal = """      {/* ── Panchanga Detail Modal ── */}
      <Modal visible={!!panchangaDetail} transparent animationType="slide" onRequestClose={() => setPanchangaDetail(null)}>"""

    # Actually, if I just put them inside the main View, it will work.
    
    with open(file_path, 'w') as f:
        f.write(content)
        
if __name__ == "__main__":
    main()
