#!/usr/bin/env python3
"""Rebuilds supabase/paste-into-dashboard/*.ts (one-file versions of the two functions).
Run from the project folder after changing anything in supabase/functions/:  python3 supabase/make-paste-files.py"""
import re, os
F = 'supabase/functions/'
def body(p):
    s = open(F + p).read()
    s = re.sub(r'^import .*?;\s*$', '', s, flags=re.M)
    s = re.sub(r'^export ', '', s, flags=re.M)
    return s.strip() + '\n'
shared = '\n'.join(f'// ---- {n} ----\n' + body('_shared/' + n) for n in ('validate.ts', 'http.ts', 'email.ts'))
os.makedirs('supabase/paste-into-dashboard', exist_ok=True)
for name in ('submit-booking', 'submit-contact'):
    idx = re.sub(r'^import .*$', '', open(F + name + '/index.ts').read(), flags=re.M).strip()
    out = f'// NSEYIN — {name}. ONE FILE: copy ALL of this into the Supabase function editor.\nimport {{ createClient }} from "npm:@supabase/supabase-js@2";\n\n{shared}\n// ---- main ----\n{idx}\n'
    open(f'supabase/paste-into-dashboard/{name}.ts', 'w').write(out)
print('ok')
