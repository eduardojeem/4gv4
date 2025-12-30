# Implementation Plan: Modern Products Dashboard

## Overview

This implementation plan breaks down the modern products dashboard redesign into incremental, actionable tasks. Each task builds upon previous work, ensuring a smooth development flow from core infrastructure to polished UI.

## Tasks

- [x] 1. Set up project structure and core utilities



  - Create directory structure for new components under `src/components/dashboard/products-modern/`
  - Set up TypeScript interfaces and types in `src/types/products-dashboard.ts`
  - Create utility functions for filtering, sorting, and calculations in `src/lib/products-dashboard-utils.ts`
  - Set up fast-check testing infrastructure and custom generators in `src/test/generators/products.ts`
  - _Requirements: All requirements (foundation)_



- [x] 1.1 Write property test for search filtering
  - **Property 1: Search filters across multiple fields**

  - **Validates: Requirements 2.1**

- [x] 1.2 Write property test for filter combination logic

  - **Property 2: Filter combination uses AND logic**

  - **Validates: Requirements 3.2, 3.3**

- [x] 1.3 Write property test for inventory value calculation
  - **Property 5: Inventory value calculation**
  - **Validates: Requirements 4.5**

- [x] 2. Implement core data filtering and search logic


  - Create `filterProducts` function that handles search across name, SKU, brand, and description
  - Create `applyFilters` function that combines multiple filter criteria with AND logic
  - Create `calculateMetrics` function for dashboard statistics (total, low stock, out of stock, inventory value)
  - Create `sortProducts` function with support for multiple fields and directions
  - Add debounce utility for search input optimization
  - _Requirements: 2.1, 2.5, 3.2, 3.3, 4.5, 15.2, 15.3_

- [x] 2.1 Write unit tests for filtering and search utilities


  - Test search across multiple fields
  - Test filter combinations
  - Test edge cases (empty search, no results, null values)
  - _Requirements: 2.1, 3.2, 3.3_

- [x] 3. Create metric cards component



  - Implement `MetricCard` component with gradient backgrounds and icons
  - Implement `MetricsGrid` component that displays 4 metric cards
  - Add click handlers to filter products by metric
  - Add responsive grid layout (4 columns → 2 → 1)
  - Add hover effects and transitions
  - _Requirements: 1.1, 1.2, 1.3, 4.1, 4.2, 4.4_

- [x] 3.1 Write property test for metric card filtering


  - **Property 4: Metric card filtering**
  - **Validates: Requirements 4.4**


- [x] 3.2 Write property test for filter count accuracy
  - **Property 3: Filter count accuracy**
  - **Validates: Requirements 3.5, 9.4**

- [x] 4. Implement search and actions bar



  - Create `SearchBar` component with icon and debounced input
  - Create `ViewModeSelector` component with grid/table/compact toggle
  - Create `FilterToggle` button component
  - Create `ActionButtons` component (refresh, export)
  - Implement `SearchAndActionsBar` container component
  - Add responsive layout for mobile
  - _Requirements: 2.1, 2.5, 5.1, 12.1, 13.1_

- [x] 5. Create filter panel component



  - Implement `FilterPanel` component with collapsible behavior
  - Add category dropdown filter (hierarchical support)
  - Add supplier dropdown filter
  - Add brand dropdown filter
  - Add price range slider filters
  - Add stock status checkbox filters
  - Add active status toggle
  - Add "Clear Filters" button
  - Add real-time product count display
  - _Requirements: 3.1, 3.2, 3.4, 3.5_

- [x] 5.1 Write property test for quick filter clearing custom filters


  - **Property 17: Quick filter clears custom filters**
  - **Validates: Requirements 9.5**

- [x] 6. Implement quick filters bar



  - Create `QuickFilterButton` component with count badge
  - Create `QuickFiltersBar` component with predefined filters
  - Implement "All Products" quick filter
  - Implement "Low Stock" quick filter
  - Implement "Out of Stock" quick filter
  - Implement "Active Products" quick filter
  - Add active state highlighting
  - Add logic to clear custom filters when quick filter applied
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 6.1 Write property test for quick filter application


  - **Property 16: Quick filter application**
  - **Validates: Requirements 9.2**

- [x] 7. Create product card component for grid view



  - Implement `ProductCard` component with modern design
  - Add product image with fallback placeholder
  - Add product name, SKU, price display
  - Add stock status indicator with color coding
  - Add selection checkbox
  - Add quick action buttons (edit, delete, duplicate, view)
  - Add hover effects (shadow, scale, reveal actions)
  - Add responsive sizing
  - _Requirements: 1.2, 1.3, 5.2, 6.1, 6.2, 6.3, 6.4, 6.5, 14.1, 14.2, 14.5_

- [x] 7.1 Write property test for product selection toggle


  - **Property 9: Individual product selection toggle**
  - **Validates: Requirements 7.1**

- [x] 7.2 Write property test for product duplication

  - **Property 8: Product duplication**
  - **Validates: Requirements 6.4**

- [x] 8. Create product table component for table view



  - Implement `ProductTable` component with sortable columns
  - Add table header with column names and sort indicators
  - Add select all checkbox in header
  - Implement `ProductRow` component
  - Add columns: checkbox, image, name, SKU, category, stock, price, status, actions
  - Add row hover effects
  - Add sticky header on scroll
  - Add responsive horizontal scroll on mobile
  - _Requirements: 5.3, 7.2, 15.1, 15.2, 15.3, 15.4_

- [x] 8.1 Write property test for select all functionality


  - **Property 10: Select all matches visible products**
  - **Validates: Requirements 7.2**


- [x] 8.2 Write property test for column sorting
  - **Property 24: Column sort ascending**
  - **Property 25: Sort toggle to descending**
  - **Validates: Requirements 15.2, 15.3**


- [x] 8.3 Write property test for sort preserving filters
  - **Property 26: Sort preserves filters and search**
  - **Validates: Requirements 15.5**

- [x] 9. Implement product grid and table containers
  - Create `ProductGrid` component that renders ProductCard array
  - Create `ProductTableContainer` that wraps ProductTable
  - Add loading skeleton states for both views
  - Add empty state displays
  - Add pagination or virtual scrolling for large lists
  - Implement view mode switching logic
  - _Requirements: 1.4, 2.4, 5.1, 5.2, 5.3_

- [x] 9.1 Write property test for view mode state preservation
  - **Property 6: View mode state preservation**
  - **Validates: Requirements 5.5**

- [x] 10. Create bulk actions toolbar
  - Implement `BulkActionsToolbar` component with fixed bottom position
  - Add selected count display
  - Add bulk action buttons (edit, delete, export, activate, deactivate)
  - Add clear selection button
  - Add slide-up animation when products selected
  - Add confirmation dialogs for destructive actions
  - _Requirements: 7.3, 7.4, 7.5_

- [x] 10.1 Write property test for bulk operation count
  - **Property 11: Bulk operation affected count**
  - **Validates: Requirements 7.5**

- [x] 11. Implement alerts banner component
  - Create `AlertsBanner` component with gradient background
  - Add alert icon and summary text
  - Add alert type grouping logic
  - Display first 3 alerts as badges with "+X more" indicator
  - Add "View Products" button to filter by alerts
  - Add dismiss functionality for individual alerts
  - Add conditional rendering (only show when alerts exist)
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 11.1 Write property test for alert grouping
  - **Property 12: Alert grouping by type**
  - **Validates: Requirements 8.2**

- [x] 11.2 Write property test for alert filtering
  - **Property 13: Alert filtering**
  - **Validates: Requirements 8.3**

- [x] 11.3 Write property test for alert dismissal
  - **Property 14: Alert dismissal**
  - **Validates: Requirements 8.4**

- [x] 11.4 Write property test for resolved alerts exclusion
  - **Property 15: Resolved alerts exclusion**
  - **Validates: Requirements 8.5**

- [x] 12. Create product form modal


  - Implement `ProductFormModal` component with clean layout
  - Add form sections: Basic Info, Classification, Pricing, Inventory, Additional Details, Images
  - Integrate React Hook Form for form state management
  - Add Zod schema for validation
  - Implement real-time field validation with inline errors
  - Add image upload component with preview
  - Add auto-generate SKU functionality
  - Add loading states and disabled submit during save
  - Add success/error handling
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 12.1 Write property test for form validation

  - **Property 18: Form field validation**
  - **Property 19: Required field validation**
  - **Validates: Requirements 10.2, 10.3**

- [x] 12.2 Write property test for edit modal pre-population

  - **Property 7: Edit modal pre-population**
  - **Validates: Requirements 6.2**

- [x] 13. Implement export functionality



  - Create `exportToCSV` function that generates CSV from product array
  - Include all product fields in export
  - Add column headers with readable names
  - Handle special characters and escaping
  - Trigger browser download automatically
  - Add export button click handler
  - Add loading state during export
  - Add error handling for export failures
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 13.1 Write property test for export matching visible products

  - **Property 20: Export matches visible products**
  - **Validates: Requirements 12.1, 12.4**

- [x] 13.2 Write property test for export including all fields

  - **Property 21: Export includes all fields**
  - **Validates: Requirements 12.2**

- [x] 14. Implement data refresh functionality

  - Add refresh button click handler
  - Implement data reload from Supabase
  - Add loading indicator on refresh button (spinning icon)
  - Preserve current view state during refresh (filters, search, sort, view mode)
  - Add error handling with error message display
  - Maintain scroll position after refresh
  - Add success toast notification
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 14.1 Write property test for refresh preserving view state

  - **Property 22: Data refresh preserves view state**
  - **Validates: Requirements 13.3**

- [x] 15. Add image handling and display


  - Implement image loading states with blur placeholders
  - Create fallback placeholder component (product initial or icon)
  - Add hover zoom effect on images
  - Handle image load errors with fallback
  - Add multiple images indicator for products with image arrays
  - Optimize images with Next.js Image component
  - Add lazy loading for images
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 15.1 Write property test for multiple images indicator

  - **Property 23: Multiple images indicator**
  - **Validates: Requirements 14.5**

- [x] 16. Implement responsive design

  - Add mobile-specific layouts for all components
  - Implement collapsible filter panel drawer for mobile
  - Stack metric cards vertically on mobile
  - Adjust font sizes and spacing for mobile
  - Add touch-optimized controls (larger tap targets)
  - Test on various screen sizes (mobile, tablet, desktop)
  - Add responsive breakpoints using Tailwind
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 17. Add animations and transitions

  - Add smooth transitions for view mode switching
  - Add fade-in animations for loading states
  - Add slide-up animation for bulk actions toolbar
  - Add hover effects with smooth transitions
  - Add skeleton loader animations
  - Add modal open/close animations
  - Add filter panel expand/collapse animations
  - Respect prefers-reduced-motion for accessibility
  - _Requirements: 1.3, 1.4_

- [x] 18. Implement error handling

  - Add error boundaries for component errors
  - Implement error toast notifications
  - Add retry buttons for failed operations
  - Display inline errors for form validation
  - Add error states for data loading failures
  - Implement graceful degradation for missing data
  - Add error logging for debugging
  - _Requirements: 12.5, 13.4_

- [x] 19. Integrate with main dashboard page

  - Replace current products page with new modern dashboard
  - Connect to existing `useProductsSupabase` hook
  - Wire up all CRUD operations (create, update, delete)
  - Connect to categories and suppliers data
  - Connect to alerts data
  - Test all data flows end-to-end
  - Add feature flag for gradual rollout (optional)
  - _Requirements: All requirements_

- [x] 20. Checkpoint - Ensure all tests pass



  - Ensure all tests pass, ask the user if questions arise.

- [x] 21. Add accessibility features



  - Add ARIA labels to all interactive elements
  - Implement keyboard navigation (Tab, Enter, Escape, Arrows)
  - Add focus indicators to all focusable elements
  - Ensure color contrast meets WCAG 2.1 AA standards
  - Add screen reader announcements for dynamic content
  - Test with keyboard-only navigation
  - Test with screen readers (NVDA, JAWS, VoiceOver)
  - Add skip links for navigation
  - _Requirements: All requirements (accessibility)_

- [x] 22. Performance optimization



  - Implement React.memo for expensive components
  - Add virtual scrolling for large product lists
  - Optimize bundle size (code splitting, tree shaking)
  - Optimize images (compression, lazy loading, blur placeholders)
  - Add performance monitoring
  - Test with large datasets (1000+ products)
  - Measure and optimize Time to Interactive
  - _Requirements: 2.5, 13.5_

- [ ] 23. Create Storybook stories
  - Create stories for MetricCard component
  - Create stories for ProductCard component
  - Create stories for ProductTable component
  - Create stories for FilterPanel component
  - Create stories for AlertsBanner component
  - Create stories for BulkActionsToolbar component
  - Add stories for loading and error states
  - Add stories for responsive layouts
  - _Requirements: All requirements (documentation)_

- [ ] 24. Cross-browser testing
  - Test on Chrome/Edge (latest 2 versions)
  - Test on Firefox (latest 2 versions)
  - Test on Safari (latest 2 versions)
  - Test on mobile browsers (iOS Safari, Chrome Android)
  - Fix any browser-specific issues
  - Document any known limitations
  - _Requirements: All requirements (compatibility)_

- [x] 25. Final polish and review


  - Review all components for visual consistency
  - Ensure all animations are smooth
  - Verify all error messages are user-friendly
  - Check all loading states are implemented
  - Verify responsive design on all breakpoints
  - Final accessibility audit
  - Code review and refactoring
  - Update documentation
  - _Requirements: All requirements_

- [x] 26. Final Checkpoint - Ensure all tests pass



  - Ensure all tests pass, ask the user if questions arise.
