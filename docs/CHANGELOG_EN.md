# Chat View Plus Changelog

This document records all significant changes to the Chat View Plus plugin.

## [1.1.2] - 2025-04-02

### Improvements
- Enhanced code documentation
  - Added comprehensive JSDoc comments for all major classes and methods
  - Improved code readability and maintainability
  - Unified comment style and format
- Enhanced user interface
  - Optimized button spacing in chat view
  - Added new chat title input styling
  - Improved overall interaction experience

### Bug Fixes
- Fixed missing code comments issues
- Optimized code structure documentation
- Fixed chat block title display issues

### Other
- Updated style files to optimize interface layout
- Improved code organization structure

## [1.1.1] - 2025-04-01

### Bug Fixes

- Fixed incorrect time display in chat window
  - Optimized time format parsing logic to support various time formats (e.g., `[2025-04-01 19:22:26]`)
  - Automatically add correctly formatted timestamps when sending messages in chat window
  - Unified core parsing functions for time information to ensure consistency
- Fixed embedded content display issues in chat window
  - Properly parse and display image embeds (`![[image.png]]` format)
  - Improved rendering logic for note embeds (`![[note]]` format)
  - Ensured correct resource path resolution for various path formats

### New Features

- Link hover preview functionality
  - **Completely native** Obsidian link experience, seamlessly integrated
  - Perfect implementation of hover previews identical to Obsidian's native experience
  - Support for preview APIs across multiple Obsidian versions to ensure maximum compatibility
  - Click links to directly jump to target files, consistent with regular Obsidian operation
  - Complete preview and navigation support for internal links (`[[link]]` format)
  - Support for creating non-existent linked files, maintaining Obsidian workflow

### Other Improvements

- Optimized performance and code quality
  - Cleaned up redundant debug logs, reducing console output
  - Refactored code logic for better maintainability
  - Updated version numbers and build configuration for future development

## [1.1.0] - 2025-03-31

### New Features

- Chat window view with real-time conversation support
- Multi-role support with custom role configuration
  - Customize role names, colors, and positions
  - Support for temporary roles and persistently saved roles
- Role color configuration for more intuitive chat experience
- Conversation saving functionality to Markdown files

### Improvements

- Enhanced Markdown parser with support for more formats and syntax
- Optimized responsive design for chat interface, adapting to different screen sizes
- Dynamic Island-style file display for improved user experience
- File binding mechanism
  - Support for binding to current active file
  - Support for specifying default files
  - Support for automatically following daily notes

## [1.0.0] - 2025-03-31

### Initial Features

- Basic chat interface
  - Left and right-aligned message bubbles
  - Role name display
  - Timestamp display
- Markdown format support
  - Basic text formatting
  - Link support
  - Code block support
- Configuration options
  - Custom conversation colors
  - Layout adjustments
- Multi-language interface support 