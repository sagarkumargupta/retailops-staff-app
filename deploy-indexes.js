const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Deploying Firebase Indexes...\n');

try {
  // Check if firebase CLI is installed
  try {
    execSync('firebase --version', { stdio: 'pipe' });
  } catch (error) {
    console.error('❌ Firebase CLI is not installed. Please install it first:');
    console.error('npm install -g firebase-tools');
    console.error('Then run: firebase login');
    process.exit(1);
  }

  // Check if firebase.json exists
  const firebaseJsonPath = path.join(__dirname, 'firebase.json');
  if (!fs.existsSync(firebaseJsonPath)) {
    console.error('❌ firebase.json not found. Please initialize Firebase first:');
    console.error('firebase init firestore');
    process.exit(1);
  }

  // Deploy indexes
  console.log('📦 Deploying indexes to Firebase...');
  execSync('firebase deploy --only firestore:indexes', { stdio: 'inherit' });
  
  console.log('\n✅ Firebase indexes deployed successfully!');
  console.log('\n📋 Next steps:');
  console.log('1. Wait a few minutes for indexes to build');
  console.log('2. Check Firebase Console > Firestore > Indexes');
  console.log('3. Test your queries again');
  
} catch (error) {
  console.error('\n❌ Error deploying indexes:', error.message);
  console.log('\n🔧 Manual steps:');
  console.log('1. Go to Firebase Console > Firestore > Indexes');
  console.log('2. Click "Add Index"');
  console.log('3. Create the following indexes manually:');
  
  const indexes = [
    'Collection: rokar, Fields: storeId (Ascending), date (Descending)',
    'Collection: rokar, Fields: storeId (Ascending), date (Ascending)',
    'Collection: attendance, Fields: staffEmail (Ascending), date (Descending)',
    'Collection: attendance, Fields: staffEmail (Ascending), date (Ascending)',
    'Collection: customers, Fields: status (Ascending), name (Ascending)',
    'Collection: tasks, Fields: assignedTo (Ascending), createdAt (Descending)',
    'Collection: tasks, Fields: storeId (Ascending), createdAt (Descending)',
    'Collection: trainings, Fields: assignedTo (Ascending), createdAt (Descending)',
    'Collection: tests, Fields: assignedTo (Ascending), createdAt (Descending)',
    'Collection: salary_requests, Fields: storeId (Ascending), createdAt (Descending)',
    'Collection: leave_requests, Fields: storeId (Ascending), createdAt (Descending)',
    'Collection: users, Fields: role (Ascending), createdAt (Descending)',
    'Collection: users, Fields: assignedStore (Ascending), role (Ascending)',
    'Collection: stores, Fields: ownerId (Ascending), createdAt (Descending)'
  ];
  
  indexes.forEach((index, i) => {
    console.log(`   ${i + 1}. ${index}`);
  });
}


