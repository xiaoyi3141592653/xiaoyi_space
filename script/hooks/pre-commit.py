#!/usr/bin/env python3
import sys
import os
from bs4 import BeautifulSoup

def process_html(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            soup = BeautifulSoup(f, 'html.parser')
            modified = False

            for a_tag in soup.find_all('a'):
                aria_label = a_tag.get('aria-label', '')
                href = a_tag.get('href', '')

                if aria_label.startswith('mailto:') and href != aria_label:
                    a_tag['href'] = aria_label
                    modified = True

            if modified:
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write(str(soup))
                print(f'Modified mailto links in: {file_path}')
                return True
    except Exception as e:
        print(f'Error processing {file_path}: {str(e)}')
    return False

if __name__ == '__main__':
    # Get staged HTML files
    staged_files = os.popen('git diff --cached --name-only --diff-filter=ACM').read().splitlines()
    html_files = [f for f in staged_files if f.lower().endswith('.html')]

    modified_files = []
    for file in html_files:
        if process_html(file):
            modified_files.append(file)

    if modified_files:
        # Re-stage modified files
        print('check modified files')
        sys.exit(1)
    sys.exit(0)