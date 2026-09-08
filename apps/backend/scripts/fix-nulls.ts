// Script to add null checks for possibly undefined values
// This runs sed replacements to fix TypeScript strict null checks

import fs from 'fs';

const file = 'apps/backend/src/modules/combat/combat.service.ts';
let content = fs.readFileSync(file, 'utf-8');

// Add null checks for array destructuring
content = content.replace(
  /const \[challenge\] = await/g,
  'const challenges = await'
);

content = content.replace(
  /if \(!challenge/g,
  'const challenge = challenges[0];\n  if (!challenge'
);

// Add null checks for target
content = content.replace(
  /const target = combat\.combatants\.find/g,
  'const targetMaybe = combat.combatants.find'
);

content = content.replace(
  /if \(!target \|\| target\.isDowned\) continue;/g,
  'const target = targetMaybe;\n      if (!target || target.isDowned) continue;'
);

fs.writeFileSync(file, content);
console.log('Fixed null checks');
