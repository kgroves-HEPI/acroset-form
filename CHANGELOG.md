# Changelog
All notable changes to this project will be documented in this file.

# Template 
### Added
- Introduced new navigation sidebar
- Added smooth scrolling behavior

### Changed
- Updated CSS for mobile responsiveness
- Improved page load time

### Fixed
- Corrected typo in header
- Fixed button alignment issue on homepage

## [1.0.0-alpha.1] - 10/23/2025
    - Converted chatgpt generated prototype to independent .html, .css, .js
    - initiated git revision control

## [1.0.0-beta] - 10/30/2025
    - Created data-collection-only branch.
    - Scrubbed functionality to turn the page into a data collection only form only
    - Minor UI tweaks
    - Added error detection
        - all fields required
        - checks across rows that all values are within .005 (eliminate typos/ bad measurements)
        - measurement fields only allow numbers to 4 decimal places. 
    - INTENDED USE: shop can fill out form, save csv, and attach to ticket.