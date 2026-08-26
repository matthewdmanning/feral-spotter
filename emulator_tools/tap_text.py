import re, sys, subprocess
target = sys.argv[1]
data = open('window_dump.xml', encoding='utf-8').read()
idx = data.find(f'text="{target}"')
if idx == -1:
    print(f"NOT FOUND: {target}"); sys.exit(1)
segment = data[:idx]
matches = list(re.finditer(r'clickable="true"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', segment))
if not matches:
    print(f"NO CLICKABLE ANCESTOR: {target}"); sys.exit(1)
x1,y1,x2,y2 = map(int, matches[-1].groups())
cx, cy = (x1+x2)//2, (y1+y2)//2
print(f"tapping {target} at {cx},{cy}")
subprocess.run(['adb','shell','input','tap',str(cx),str(cy)])
