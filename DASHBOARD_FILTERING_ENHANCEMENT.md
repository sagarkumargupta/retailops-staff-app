# Dashboard Filtering Enhancement

## Current Implementation

The dashboard filtering system has been implemented with the following features:

### ✅ Completed Features

1. **Global Filter UI**: Added a comprehensive filter section below the welcome message for admin users
2. **Store Performance Filtering**: Filters store performance data based on selected store, brand, or location
3. **Staff Performance Filtering**: Filters staff performance data based on selected store, brand, or location
4. **Filter State Management**: Proper state management for filter selections and view modes
5. **UI Integration**: Dashboard cards now use `displayStats` which shows filtered data for admin users

### 🔧 Technical Implementation

- **State Variables**: Added `filteredStats`, `filteredAttendanceData`, `filteredTodaysAttendance` for filtered data
- **Display Logic**: Created `displayStats` and `displayTodaysAttendance` variables that show filtered data for admins, original data for others
- **Filter Functions**: Created placeholder functions for stats recalculation
- **Async Support**: Made `applyStoreFilters` async to support future database queries

### 📊 Current Filter Behavior

- **Store Performance**: ✅ Fully filtered by store/brand/location
- **Staff Performance**: ✅ Fully filtered by store/brand/location  
- **Today's Attendance**: ✅ Fully filtered by store/brand/location
- **Dashboard Cards**: ✅ Uses filtered stats (but stats are not recalculated yet)
- **Attendance Data**: ⚠️ Uses filtered stats (but not recalculated)

## 🚧 Pending Enhancements

### 1. Stats Recalculation Functions

The following functions need to be implemented to properly recalculate stats based on filters:

```javascript
// These functions currently return original stats
const recalculateStatsForStore = async (storeId) => {
  // TODO: Query database for stats specific to this store
  // - Total staff in this store
  // - Sales data for this store
  // - Attendance data for this store
  // - Tasks/trainings/tests for this store
};

const recalculateStatsForBrand = async (brand) => {
  // TODO: Query database for stats specific to this brand
  // - Aggregate data across all stores of this brand
};

const recalculateStatsForLocation = async (location) => {
  // TODO: Query database for stats specific to this location
  // - Aggregate data across all stores in this location
};

const recalculateStatsWithFilters = async (storeIds, brands, locations) => {
  // TODO: Query database with multiple filter criteria
  // - Complex filtering logic
};
```

### 2. Database Queries Needed

To properly implement stats filtering, the following database queries are needed:

#### Store-Specific Stats
```javascript
// Get stores by filter criteria
const storesQuery = query(
  collection(db, 'stores'),
  where('brand', '==', selectedBrand), // if brand filter
  where('location', '==', selectedLocation) // if location filter
);

// Get staff for filtered stores
const staffQuery = query(
  collection(db, 'users'),
  where('storeId', 'in', filteredStoreIds)
);

// Get sales data for filtered stores
const salesQuery = query(
  collection(db, 'rokar'),
  where('storeId', 'in', filteredStoreIds),
  where('date', '>=', monthStartStr)
);

// Get attendance for filtered stores
const attendanceQuery = query(
  collection(db, 'attendance'),
  where('storeId', 'in', filteredStoreIds),
  where('date', '>=', monthStartStr)
);
```

### 3. Performance Considerations

- **Caching**: Consider caching filtered results to avoid repeated database queries
- **Pagination**: For large datasets, implement pagination
- **Real-time Updates**: Consider real-time updates when data changes

### 4. UI Enhancements

- **Loading States**: Add loading indicators during stats recalculation
- **Filter Summary**: Show more detailed filter information
- **Export Filtered Data**: Allow exporting filtered data to CSV/Excel

## 🎯 Next Steps

1. **Implement Store-Specific Stats**: Start with `recalculateStatsForStore` function
2. **Add Database Queries**: Create efficient queries for filtered data
3. **Test Performance**: Ensure filtering doesn't impact dashboard load times
4. **Add Loading States**: Improve user experience during filtering
5. **Enhance Filter UI**: Add more filter options and better UX

## 📝 Notes

- The current implementation provides a solid foundation for comprehensive filtering
- All UI components are ready to display filtered data
- The filtering logic is extensible and can be enhanced incrementally
- Performance should be monitored as more complex filtering is added
