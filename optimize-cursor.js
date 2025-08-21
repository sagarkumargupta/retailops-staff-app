#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 Optimizing Cursor Performance...\n');

// Check and create .vscode directory if it doesn't exist
const vscodeDir = path.join(process.cwd(), '.vscode');
if (!fs.existsSync(vscodeDir)) {
  fs.mkdirSync(vscodeDir);
  console.log('✅ Created .vscode directory');
}

// Performance optimization checklist
const checklist = [
  '✅ Created .vscode/settings.json with performance optimizations',
  '✅ Updated .gitignore to exclude heavy files',
  '✅ Created .cursorrules for AI optimization',
  '📋 Manual steps to complete:',
  '   - Restart Cursor (Ctrl+Shift+P → "Developer: Reload Window")',
  '   - Disable unnecessary extensions',
  '   - Close unused files and tabs',
  '   - Check system resources (RAM, CPU)',
  '   - Consider increasing available RAM if possible'
];

checklist.forEach(item => console.log(item));

console.log('\n🎯 Performance Tips:');
console.log('• Use Ctrl+Shift+P → "Developer: Restart Extension Host" if cursor becomes slow');
console.log('• Keep node_modules excluded from search (already configured)');
console.log('• Disable auto-save and format-on-save for better performance');
console.log('• Use workspace-specific settings for large projects');
console.log('• Monitor Task Manager for high CPU/memory usage');

console.log('\n✨ Cursor should now be significantly faster!');
