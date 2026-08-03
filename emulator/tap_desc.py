import re, sys, subprocess
target = sys.argv[1]
data = open('window_dump.xml', encoding='utf-8').read()
pattern = re.compile(r'<node[^>]*content-desc="' + re.escape(target) + r'"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
m = pattern.search(data)
if not m:
    print(f"NOT FOUND (same-tag bounds): {target}"); sys.exit(1)
x1,y1,x2,y2 = map(int, m.groups())
cx, cy = (x1+x2)//2, (y1+y2)//2
print(f"tapping {target} at {cx},{cy}")
subprocess.run(['adb','shell','input','tap',str(cx),str(cy)])
