
// Mock the dataService logic directly to test the filtering logic
// (Since we can't easily import the real file due to Vite env vars)

function searchLocalCoursesMock(allCourses, criteria) {
    const { query, location, dateStart, dateEnd } = criteria;

    let filtered = allCourses;

    // 2. Filter by Location (Venue) - Supports multiple comma-separated values (OR logic)
    if (location && location.trim() !== '') {
        const locationTerms = location.split(',').map(l => l.trim().toLowerCase()).filter(l => l.length > 0);

        if (locationTerms.length > 0) {
            filtered = filtered.filter(c => {
                const venueLower = c.venue.toLowerCase();
                // Match if venue contains ANY of the search terms
                return locationTerms.some(term => venueLower.includes(term));
            });
        }
    }

    return { courses: filtered };
};

// Mock courses
const mockCourses = [
    { id: 1, name: "Course 1", venue: "Stratford", start_date: "2026-01-01", price: "100" },
    { id: 2, name: "Course 2", venue: "Chelmsford", start_date: "2026-01-01", price: "100" },
    { id: 3, name: "Course 3", venue: "London Central", start_date: "2026-01-01", price: "100" },
    { id: 4, name: "Course 4", venue: "Manchester", start_date: "2026-01-01", price: "100" }
];

// Test Case 1: Search for "London" (Old behavior simulation, single term)
console.log("--- Test 1: Single Term 'London' ---");
const result1 = searchLocalCoursesMock(mockCourses, { location: "London" });
console.log("Found:", result1.courses.map(c => c.venue));
// Expected: "London Central" only

// Test Case 2: Search for "London, Stratford" (New behavior)
console.log("\n--- Test 2: Multi Term 'London, Stratford' ---");
const result2 = searchLocalCoursesMock(mockCourses, { location: "London, Stratford" });
console.log("Found:", result2.courses.map(c => c.venue));
// Expected: "Stratford", "London Central"

// Test Case 3: Search for "Essex, Chelmsford"
console.log("\n--- Test 3: Multi Term 'Essex, Chelmsford' ---");
const result3 = searchLocalCoursesMock(mockCourses, { location: "Essex, Chelmsford" });
console.log("Found:", result3.courses.map(c => c.venue));
// Expected: "Chelmsford"

if (result2.courses.length === 2 && result3.courses.length === 1) {
    console.log("\nSUCCESS: Multi-location search works as expected.");
} else {
    console.log("\nFAILURE: Search results did not match expectations.");
}
