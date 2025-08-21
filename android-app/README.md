# RetailOps Staff Android App

A comprehensive Android application for retail staff management with offline-first architecture and real-time synchronization capabilities.

## 🚀 Features

### Core Functionality
- **📱 Modern UI**: Built with Jetpack Compose and Material Design 3
- **🔄 Offline-First**: SQLite database for local storage with sync capabilities
- **🌐 Real-time Sync**: Firebase Firestore integration for cloud synchronization
- **📍 Location Tracking**: GPS-based attendance tracking
- **📊 Analytics**: Built-in charts and reporting

### Staff Modules

#### 1. **Attendance Management**
- Check-in/Check-out with location tracking
- Weekly attendance summary
- Offline attendance recording
- Automatic sync when online

#### 2. **Sales Tracking**
- Record daily sales transactions
- Multiple payment methods (Cash, Card, UPI)
- Customer information tracking
- Sales analytics and reports

#### 3. **Expense Management**
- Submit expense requests
- Upload receipt photos
- Track expense approvals
- Expense categories and reporting

#### 4. **Salary Requests**
- Request salary advances
- Track request status
- Payment history
- Approval workflow

#### 5. **Leave Management**
- Submit leave requests
- Track leave balance
- Approval status tracking
- Leave calendar view

#### 6. **Target Management**
- View monthly targets
- Track achievement progress
- Performance analytics
- Goal setting

#### 7. **Rokar Entry**
- Daily financial entries
- Opening/closing balance tracking
- Expense categorization
- Financial reporting

#### 8. **Profile & Settings**
- User profile management
- Store assignment
- Sync settings
- App preferences

## 🛠 Technical Stack

### Frontend
- **Jetpack Compose**: Modern UI toolkit
- **Material Design 3**: Latest design system
- **Navigation Compose**: Screen navigation
- **ViewModel & LiveData**: State management

### Backend & Data
- **Firebase Firestore**: Cloud database
- **Firebase Auth**: Authentication
- **Firebase Storage**: File storage
- **SQLite**: Local database
- **Room**: Database abstraction

### Location & Services
- **Google Play Services**: Location tracking
- **FusedLocationProvider**: GPS services
- **WorkManager**: Background tasks
- **DataStore**: Preferences storage

### Networking
- **Retrofit**: HTTP client
- **OkHttp**: Network interceptor
- **Coroutines**: Asynchronous programming
- **Kotlin Flow**: Reactive streams

## 📱 Screenshots

### Dashboard
- Quick access to all modules
- Sync status indicator
- Recent activity feed
- User profile access

### Attendance
- Check-in/Check-out buttons
- Location tracking
- Daily status overview
- Weekly summary

### Sales
- Transaction entry form
- Payment method selection
- Customer details
- Sales history

### Expenses
- Expense request form
- Receipt upload
- Category selection
- Approval tracking

## 🔧 Setup Instructions

### Prerequisites
- Android Studio Arctic Fox or later
- Android SDK 24+
- Google Play Services
- Firebase project

### 1. Clone the Repository
```bash
git clone <repository-url>
cd android-app
```

### 2. Firebase Setup
1. Create a Firebase project
2. Add Android app to Firebase project
3. Download `google-services.json`
4. Place in `app/` directory

### 3. Configure Firebase
1. Enable Authentication (Email/Password)
2. Create Firestore database
3. Set up security rules
4. Enable Storage for receipts

### 4. Build Configuration
1. Update `app/build.gradle.kts` if needed
2. Sync project with Gradle files
3. Build the project

### 5. Run the App
1. Connect Android device or start emulator
2. Run the app from Android Studio
3. Grant necessary permissions

## 📊 Database Schema

### Local SQLite Tables
- `users`: User profiles and authentication
- `stores`: Store information
- `attendance`: Daily attendance records
- `sales`: Sales transactions
- `expenses`: Expense requests
- `salary_requests`: Salary advance requests
- `leave_requests`: Leave applications
- `targets`: Monthly targets
- `rokar_entries`: Daily financial entries
- `sync_status`: Synchronization status

### Firestore Collections
- `users`: User profiles
- `stores`: Store data
- `attendance`: Attendance records
- `sales`: Sales data
- `other_expenses`: Expense requests
- `salary_requests`: Salary requests
- `leave_requests`: Leave requests
- `targets`: Target data
- `rokar`: Financial entries

## 🔄 Sync Architecture

### Offline-First Design
1. **Local Storage**: All data stored in SQLite
2. **Offline Operations**: Full functionality without internet
3. **Background Sync**: Automatic sync when online
4. **Conflict Resolution**: Timestamp-based conflict handling

### Sync Process
1. **Download**: Fetch latest data from Firestore
2. **Upload**: Send local changes to server
3. **Merge**: Resolve conflicts automatically
4. **Status Update**: Mark records as synced

## 🔐 Security Features

### Authentication
- Firebase Authentication
- Email/Password login
- Session management
- Auto-logout on inactivity

### Data Security
- Encrypted local storage
- Secure API communication
- Role-based access control
- Data validation

### Permissions
- Location access for attendance
- Camera for receipt photos
- Storage for file uploads
- Network for synchronization

## 📈 Performance Optimizations

### UI Performance
- Lazy loading for lists
- Image caching with Coil
- Efficient state management
- Smooth animations

### Data Performance
- Pagination for large datasets
- Efficient database queries
- Background sync optimization
- Memory management

### Network Performance
- Request caching
- Compression
- Retry mechanisms
- Offline queue management

## 🧪 Testing

### Unit Tests
- ViewModel testing
- Repository testing
- Use case testing
- Utility function testing

### UI Tests
- Screen navigation testing
- User interaction testing
- Accessibility testing
- Performance testing

### Integration Tests
- Database operations
- API integration
- Sync functionality
- End-to-end workflows

## 📱 Device Requirements

### Minimum Requirements
- Android 7.0 (API 24)
- 2GB RAM
- 100MB storage
- GPS capability
- Camera (for receipts)

### Recommended
- Android 10+ (API 29)
- 4GB+ RAM
- 500MB+ storage
- High-accuracy GPS
- Good camera quality

## 🚀 Deployment

### Release Build
1. Update version in `build.gradle.kts`
2. Generate signed APK/Bundle
3. Test on multiple devices
4. Upload to Google Play Store

### Beta Testing
1. Create internal testing track
2. Add test users
3. Monitor crash reports
4. Collect feedback

## 📞 Support

### Documentation
- API documentation
- User guides
- Troubleshooting guides
- FAQ section

### Contact
- Email: support@retailops.com
- Phone: +1-800-RETAIL
- Live chat: Available in app

## 🔄 Version History

### v1.0.0 (Current)
- Initial release
- Core functionality
- Offline support
- Basic sync

### Planned Features
- Push notifications
- Advanced analytics
- Multi-language support
- Dark mode
- Widget support

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests
5. Submit pull request

## 📊 Analytics

The app includes analytics for:
- User engagement
- Feature usage
- Performance metrics
- Error tracking
- Sync statistics

---

**Built with ❤️ for retail staff management**
