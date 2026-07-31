import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    def replacer(match):
        url = match.group(0)
        
        # Unsplash logic
        if 'unsplash.com' in url:
            if 'q=80' in url:
                url = url.replace('q=80', 'q=85')
            elif 'q=' not in url:
                if '?' in url:
                    url += '&q=85'
                else:
                    url += '?q=85'
            return url
            
        # Pexels logic
        if 'pexels.com' in url:
            # Check if it already has parameters
            if '?' in url:
                # If it has q=80, replace it with q=85
                if 'q=80' in url:
                    url = url.replace('q=80', 'q=85')
                # If it doesn't have a q= parameter at all, add q=85
                elif 'q=' not in url:
                    url += '&q=85'
            else:
                # No parameters at all, add the standard set
                url += '?auto=compress&cs=tinysrgb&w=800&q=90'
            return url
            
        return url

    # Match anything that looks like an image URL in quotes
    # E.g. 'https://images.pexels.com/...'
    new_content = re.sub(r"https://images\.(?:pexels|unsplash)\.com/[^\s']+", replacer, content)

    with open(filepath, 'w') as f:
        f.write(new_content)
    
    print("Done processing.")

process_file('/Users/hotelnamastebharatinn/Desktop/Morning-App/lib/sleepSoundsData.ts')
