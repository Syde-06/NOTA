# Nota App - Completion Prompt

## Project Overview
**Nota** is a React Native/Expo document annotation and highlighting app built with Supabase backend. It allows users to import documents (PDF, DOCX), highlight and annotate text with color-coded roles, and manage their document library.

## Core Technologies
- **Frontend**: React Native (Expo)
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Key Libraries**: 
  - `react-native-paper` (UI components)
  - `expo-document-picker` (file selection)
  - `react-native-webview` (document viewing)
  - `jszip` (text extraction from DOCX)
  - `@react-native-async-storage/async-storage` (local persistence)
  - `@supabase/supabase-js` (backend integration)

## App Architecture

### Navigation Structure
- **Login Screen**: Authentication (sign in/sign up) with fallback test account (`test@example.com` / `123456`)
- **Main Tabs**: Home, Document, Profile
- **Modal Screens**: Import, Export, Preview, DocumentViewer, HighlightWorkspace

### State Management
- **AppContext** (`contexts/AppContext.js`): 
  - Manages authentication, user profile, status message, activity feed
  - Handles login, sign up, logout, profile updates
  - Persists data to AsyncStorage
  - Integrates with Supabase for cloud sync

### Key Database Tables
- `profiles` - User profiles (id, full_name, email, created_at)
- `documents` - User documents (id, user_id, name, size, url, extracted_text, uploaded_at, deleted_at)
- `highlights` - Text highlights (id, document_id, user_id, start_pos, end_pos, role, color, text, created_at)

## Screens & Components Status

### ✅ Implemented Components
1. **LoginScreen** - Authentication with email/password, form validation, sign up flow
2. **HomeScreen** - Dashboard with recent documents, search, activity feed
3. **DocumentScreen** - Full document library with filtering, sorting (Newest/Oldest/A-Z/Largest), search
4. **HighlightScreen** - Advanced text highlighting interface with color-coded roles (Title, Definition, List, Example, Summary)
5. **ImportScreen** - Document upload with DOCX/PDF text extraction
6. **ProfileScreen** - User profile management, status message, activity feed, logout
7. **ExportScreen** - Export highlights (structure needs completion)
8. **PreviewScreen** - Document preview (structure needs completion)
9. **DocumentViewerScreen** - Full document viewer (structure needs completion)
10. **TabNav** - Bottom navigation between main tabs
11. **BottomNav** - Bottom menu for quick actions
12. **UI Components**: FormInput, PrimaryButton

## Incomplete Features & TODO Items

### 1. **Export Functionality** (ExportScreen.js)
- [ ] Generate export formats: JSON, CSV, Markdown, PDF
- [ ] Filter highlights by role/color
- [ ] Date range filtering for exports
- [ ] Export to cloud storage (Supabase)
- [ ] Share exported highlights via email/link

### 2. **Document Viewer Enhancement** (DocumentViewerScreen.js)
- [ ] Full document display with proper pagination
- [ ] Highlight synchronization with HighlightScreen
- [ ] Navigation to specific highlights
- [ ] Text selection and quick-highlighting
- [ ] Bookmark management

### 3. **Preview Screen** (PreviewScreen.js)
- [ ] Quick preview of documents before opening
- [ ] Thumbnail generation
- [ ] Metadata display (size, pages, upload date)
- [ ] Quick actions (view, highlight, delete)

### 4. **Search & Filter Enhancement**
- [ ] Global search across all highlights
- [ ] Filter highlights by date range
- [ ] Filter by color role
- [ ] Search by text content across all documents
- [ ] Saved search filters

### 5. **Highlight Management**
- [ ] Edit existing highlights
- [ ] Delete highlights with confirmation
- [ ] Bulk actions (delete, export all)
- [ ] Highlight statistics and analytics
- [ ] Notes/annotations on highlights

### 6. **Synchronization & Offline Support**
- [ ] Offline highlight capability
- [ ] Sync with Supabase when online
- [ ] Conflict resolution for offline edits
- [ ] Background sync queue

### 7. **Document Management**
- [ ] Organize documents into collections/folders
- [ ] Bulk document operations (delete, move, copy)
- [ ] Document sharing with other users
- [ ] Collaborative highlighting

### 8. **UI/UX Polish**
- [ ] Loading states for all async operations
- [ ] Error boundaries and error messages
- [ ] Toast/notification system
- [ ] Pull-to-refresh on document lists
- [ ] Haptic feedback on interactions
- [ ] Animations for transitions

### 9. **Settings & Preferences**
- [ ] Theme customization (dark/light mode)
- [ ] Default highlight colors
- [ ] Document organization preferences
- [ ] Privacy settings
- [ ] Data backup options

### 10. **Performance & Optimization**
- [ ] Pagination for large document lists
- [ ] Image/text lazy loading
- [ ] Database query optimization
- [ ] Memory management for large documents
- [ ] Caching strategy

## Color Roles Configuration
All screens should use these standardized highlight roles:
```javascript
const COLOR_ROLES = [
  { color: '#FF3B30', label: 'Title', emoji: '🔴' },
  { color: '#FFCC00', label: 'Definition', emoji: '🟡' },
  { color: '#34C759', label: 'List', emoji: '🟢' },
  { color: '#007AFF', label: 'Example', emoji: '🔵' },
  { color: '#AF52DE', label: 'Summary', emoji: '🟣' },
];
```

## API Integration Points

### Supabase Auth
- `signInWithPassword(email, password)` - Sign in
- `signUp(email, password, options)` - Register
- `signOut()` - Logout
- `getSession()` - Get current session

### Supabase Database (REST API)
- **Fetch documents**: `GET /rest/v1/documents` with filters
- **Fetch highlights**: `GET /rest/v1/highlights` with filters
- **Create highlight**: `POST /rest/v1/highlights`
- **Update highlight**: `PATCH /rest/v1/highlights`
- **Delete highlight**: `DELETE /rest/v1/highlights`
- **Upload document**: `POST /rest/v1/documents`

### Supabase Storage
- Upload documents to `documents/{user_id}/` bucket
- Manage document files with versioning

## Development Guidelines

### Code Style
- Use functional components with hooks
- Implement proper error handling
- Add console.logs for debugging (remove in production)
- Follow React naming conventions (PascalCase for components)

### State Management
- Use Context API for global state (AppContext)
- Use useState for local component state
- Use useCallback for memoized functions
- Use useMemo for expensive computations

### Performance
- Memoize expensive components with React.memo
- Lazy load screens with dynamic imports
- Optimize re-renders with proper dependencies
- Use FlatList/SectionList for large lists (not ScrollView)

### Testing
- Test auth flows (login, sign up, logout)
- Test document CRUD operations
- Test highlight creation and deletion
- Test data persistence and sync

## Environment Setup
- Supabase project configuration in `components/supabase.js`
- Environment variables: SUPABASE_URL, SUPABASE_ANON_KEY
- Local storage keys: `@nota/session`, `@nota/profile`, `@nota/status`, `@nota/activity`

## Next Steps for Implementation
1. Complete ExportScreen with multiple export formats
2. Enhance DocumentViewerScreen with full viewer capabilities
3. Implement PreviewScreen
4. Add global search and filtering
5. Implement offline sync queue
6. Add performance optimizations
7. Implement collaborative features
8. Add analytics and user insights
9. Polish UI with animations and haptics
10. Implement comprehensive error handling

---

## Running the App
```bash
npm start              # Start dev server
expo start --android   # Run on Android
expo start --ios       # Run on iOS (macOS only)
expo start --web       # Run on web
```

## Test Credentials
- **Email**: test@example.com
- **Password**: 123456
