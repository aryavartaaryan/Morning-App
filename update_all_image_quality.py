import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    def replacer(match):
        url = match.group(0)
        
        # Strip existing query parameters for pexels
        if 'pexels.com' in url:
            base_url = url.split('?')[0]
            # Add uniform parameters: auto=compress&cs=tinysrgb&w=800&q=90
            return base_url + '?auto=compress&cs=tinysrgb&w=800&q=90'
            
        # Strip existing query parameters for unsplash
        if 'unsplash.com' in url:
            base_url = url.split('?')[0]
            return base_url + '?w=800&q=90&auto=format&fit=crop'
            
        return url

    # Match anything that looks like an image URL in quotes
    new_content = re.sub(r"https://images\.(?:pexels|unsplash)\.com/[^\s'\"]+", replacer, content)

    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")
    else:
        print(f"No changes for {filepath}")

for f in ['lib/sleepSoundsData.ts', 'lib/soundImagePreload.ts', 'lib/bgImages.ts']:
    process_file(f)
