// Global variables to store IC data and currently displayed data
let icData = []; // Stores all loaded IC data from both files
let filteredData = []; // Stores ICs filtered by search/family
let currentFilter = 'all'; // Stores the currently active filter ('all', 'ttl', 'cmos')

// Pagination/Load More variables
const icsPerPage = 20; // Number of ICs to display per "page" load
let currentPage = 1;
let isLoading = false; // Flag to prevent multiple load requests

// DOM element references
const icContainer = document.getElementById('icContainer');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn'); // Clear search button
const filterButtons = document.querySelectorAll('.filter-btn');
const loadingMessage = document.getElementById('loadingMessage');
const errorMessage = document.getElementById('errorMessage');
const noResultsMessage = document.getElementById('noResultsMessage');
const loadMoreBtn = document.getElementById('loadMoreBtn'); // Load More button
const endOfResultsMessage = document.getElementById('endOfResultsMessage'); // End of results message
const backToTopBtn = document.getElementById('backToTopBtn'); // Back to Top button


// IC Details Modal elements
const modal = document.getElementById('icModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalICNumber = document.getElementById('modalICNumber');
const modalFunction = document.getElementById('modalFunction');
const modalDescription = document.getElementById('modalDescription');
const modalConnectionSection = document.getElementById('modalConnectionSection');
const modalConnectionDiagram = document.getElementById('modalConnectionDiagram');
const connDiagramNA = document.getElementById('connDiagramNA');
const modalFunctionSection = document.getElementById('modalFunctionSection');
const modalFunctionTable = document.getElementById('modalFunctionTable');
const funcTableNA = document.getElementById('funcTableNA');
const modalDatasheetLink = document.getElementById('modalDatasheetLink');
const modalDatasheetNA = document.getElementById('modalDatasheetNA');

// Image Enlargement Modal elements
const imageModal = document.getElementById('imageModal');
const closeImageModalBtn = document.getElementById('closeImageModalBtn');
const enlargedImage = document.getElementById('enlargedImage');

// --- Initialization ---
// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
    // Load data from both CSV files
    loadICData();

    // Set up event listeners
    searchInput.addEventListener('input', handleSearchInput); // Use a new handler for input
    clearSearchBtn.addEventListener('click', clearSearch); // Clear search button listener
    filterButtons.forEach(button => {
        button.addEventListener('click', handleFilter);
    });
    closeModalBtn.addEventListener('click', closeModal);
    closeImageModalBtn.addEventListener('click', closeImageModal);
    loadMoreBtn.addEventListener('click', loadMoreICs); // Load More button listener
    backToTopBtn.addEventListener('click', scrollToTop); // Back to Top button listener

    // Close modals when clicking outside or pressing Escape key
    window.addEventListener('click', outsideClick);
    window.addEventListener('keydown', escapeKeyClose);

    // Show/hide Back to Top button based on scroll position
    window.addEventListener('scroll', handleScroll);
});

/**
 * Loads IC data from TTL and CMOS CSV files.
 */
async function loadICData() {
    // Show loading message and hide others
    showStatusMessage('loading');
    icContainer.innerHTML = ''; // Clear existing content
    loadMoreBtn.style.display = 'none'; // Hide load more button
    loadMoreBtn.disabled = true;
    endOfResultsMessage.style.display = 'none'; // Hide end of results message
    endOfResultsMessage.setAttribute('aria-hidden', 'true');


    try {
        // Fetch both files concurrently
        const [ttlResponse, cmosResponse] = await Promise.all([
            fetch('ttl.csv'),
            fetch('cmos.csv')
        ]);

        // Check if fetching was successful
        if (!ttlResponse.ok) throw new Error(`Failed to load ttl.csv: ${ttlResponse.status}`);
        if (!cmosResponse.ok) throw new Error(`Failed to load cmos.csv: ${cmosResponse.status}`);

        const ttlCsvData = await ttlResponse.text();
        const cmosCsvData = await cmosResponse.text();

        // Parse and combine data
        const ttlData = parseCSV(ttlCsvData, 'ttl');
        const cmosData = parseCSV(cmosCsvData, 'cmos');
        icData = [...ttlData, ...cmosData]; // Combine both arrays

        // Initial rendering - load the first page
        applyFilterAndSearch();

    } catch (error) {
        console.error('Error loading or parsing CSV files:', error);
        showStatusMessage('error');
        icContainer.innerHTML = ''; // Ensure container is empty
    } finally {
        // Loading message is hidden by showStatusMessage or applyFilterAndSearch
    }
}


/**
 * Parses CSV data into an array of IC objects.
 * Uses a regex to handle commas within quoted fields and correctly extracts columns.
 * Assumes the first line is a header and skips it.
 * Assumes the order: Index, IC Number, Function, Description, Conn Diagram, Func Table, Datasheet Link
 * @param {string} csv - The CSV data as a string.
 * @param {string} family - The IC family ('ttl' or 'cmos') to assign to these ICs.
 * @returns {Array<Object>} An array of IC objects.
 */
function parseCSV(csv, family) {
    const lines = csv.split('\n');
    const result = [];
    // Regex to split by comma that is not inside double quotes.
    // It also handles potential double quotes around fields and removes them.
    const csvRegex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;

    // Iterate through lines starting from the second line (index 1), skipping header
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Skip empty lines

        // Split the line using the regex
        const columns = line.split(csvRegex).map(col => col.trim()); // Trim whitespace from each column

        // Ensure the line has at least 7 columns
        if (columns.length < 7) {
             console.warn(`Skipping malformed or incomplete CSV line (expected at least 7 columns): "${line}"`);
             continue;
        }

        // Function to clean a field (remove surrounding quotes and handle escaped quotes)
        const cleanField = (field) => {
             if (!field) return '';
             // Remove surrounding double quotes if they exist
             if (field.startsWith('"') && field.endsWith('"')) {
                 field = field.substring(1, field.length - 1);
             }
             // Replace escaped double quotes ("") with a single double quote
             field = field.replace(/""/g, '"');
             return field;
        };

        const ic = {
            // Use cleanField for fields that might contain commas or quotes
            number: cleanField(columns[1]),
            function: cleanField(columns[2]),
            description: cleanField(columns[3]),
            // Check for "Yes" explicitly, case-insensitive. Default to false if column is missing or not "Yes".
            hasConnectionDiagram: columns[4] ? columns[4].toLowerCase() === 'yes' : false,
            hasFunctionTable: columns[5] ? columns[5].toLowerCase() === 'yes' : false,
            datasheetLink: cleanField(columns[6]), // Datasheet link
            family: family // Assign the family based on the source file (ttl or cmos)
        };

        // Only add ICs with a non-empty number and function
        if (ic.number && ic.function) {
            result.push(ic);
        } else {
             console.warn(`Skipping line with missing IC number or function: "${line}"`);
        }
    }
    return result;
}


/**
 * Applies the current filter and search terms to the data and updates the display.
 * Resets pagination and clears the container before rendering the first page.
 */
function applyFilterAndSearch() {
    const searchTerm = searchInput.value.toLowerCase();

    // First, filter by family
    let dataAfterFilter = (currentFilter === 'all') ? icData : icData.filter(ic => ic.family === currentFilter);

    // Then, filter by search term (case-insensitive)
    filteredData = dataAfterFilter.filter(ic => {
        return ic.number.toLowerCase().includes(searchTerm) ||
               ic.function.toLowerCase().includes(searchTerm) ||
               ic.description.toLowerCase().includes(searchTerm);
    });

    // Reset pagination for the new filtered/searched data
    currentPage = 1;
    icContainer.innerHTML = ''; // Clear the container
    endOfResultsMessage.style.display = 'none'; // Hide end message
    endOfResultsMessage.setAttribute('aria-hidden', 'true');


    // Render the first page of results
    renderICCards(filteredData.slice(0, icsPerPage));

    // Show/hide load more button based on total results
    if (filteredData.length > icsPerPage) {
        loadMoreBtn.style.display = 'block';
        loadMoreBtn.disabled = false;
    } else {
        loadMoreBtn.style.display = 'none';
        loadMoreBtn.disabled = true;
         if (filteredData.length > 0) { // Show end message only if there are results
             endOfResultsMessage.style.display = 'block';
             endOfResultsMessage.setAttribute('aria-hidden', 'false');
         }
    }

    // Hide status messages if there are results
     if (filteredData.length > 0) {
         hideStatusMessages();
     } else if (searchTerm || currentFilter !== 'all') {
         // If no results after search/filter, show no results message
         showStatusMessage('no-results');
     } else {
         // If no results on initial load (empty data), show error message (handled by loadICData)
     }
}

/**
 * Renders a batch of IC cards to the DOM. Appends to the container.
 * @param {Array<Object>} ics - The array of IC objects to display.
 */
function renderICCards(ics) {
    if (ics.length === 0 && currentPage === 1) {
         // This case is handled by applyFilterAndSearch showing 'no-results'
         return;
    }

    ics.forEach((ic, index) => {
        const card = document.createElement('div');
        card.className = 'ic-card';
        card.dataset.number = ic.number;
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-label', `${ic.number}: ${ic.function}`);
        // Add a slight animation delay based on index within the current batch
        card.style.animationDelay = `${index * 0.05}s`;


        card.innerHTML = `
            <div class="ic-card-header">
                <h3>${ic.number}</h3>
                <p>${ic.function}</p>
            </div>
            <div class="ic-card-body">
                <p>${ic.description ? (ic.description.substring(0, 180) + (ic.description.length > 180 ? '...' : '')) : 'No description available.'}</p>
            </div>
        `;

        // Add click event listener to open modal
        card.addEventListener('click', () => openModal(ic));
         // Add keyboard event listener for accessibility (Enter and Space)
        card.addEventListener('keypress', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openModal(ic);
            }
        });

        icContainer.appendChild(card);
    });
}

/**
 * Handles the search input event.
 */
function handleSearchInput() {
    // Show/hide clear button based on input value
    if (searchInput.value.length > 0) {
        clearSearchBtn.style.display = 'block';
    } else {
        clearSearchBtn.style.display = 'none';
    }
    applyFilterAndSearch(); // Apply filter and search whenever input changes
}

/**
 * Clears the search input and reapplies filters.
 */
function clearSearch() {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    applyFilterAndSearch();
     searchInput.focus(); // Return focus to search input after clearing
}


/**
 * Handles the filter button click event.
 * @param {Event} e - The click event.
 */
function handleFilter(e) {
    const filter = e.target.dataset.filter;

    // Update active button state
    filterButtons.forEach(button => {
        button.classList.remove('active');
        button.setAttribute('aria-pressed', 'false');
    });
    e.target.classList.add('active');
    e.target.setAttribute('aria-pressed', 'true');

    currentFilter = filter;

    applyFilterAndSearch(); // Apply the new filter along with the current search term
}

/**
 * Loads the next batch of ICs when the "Load More" button is clicked.
 */
function loadMoreICs() {
    if (isLoading) return; // Prevent multiple loads

    isLoading = true;
    loadMoreBtn.disabled = true; // Disable button while loading
    // Optional: Show a loading indicator near the button

    const startIndex = currentPage * icsPerPage;
    const endIndex = startIndex + icsPerPage;
    const nextBatch = filteredData.slice(startIndex, endIndex);

    if (nextBatch.length > 0) {
        renderICCards(nextBatch);
        currentPage++;

        // Check if there are more results to load
        if (filteredData.length > currentPage * icsPerPage) {
            loadMoreBtn.style.display = 'block';
            loadMoreBtn.disabled = false;
        } else {
            loadMoreBtn.style.display = 'none';
            loadMoreBtn.disabled = true;
            endOfResultsMessage.style.display = 'block'; // Show end message
            endOfResultsMessage.setAttribute('aria-hidden', 'false');
        }
    } else {
        // No more results to load
        loadMoreBtn.style.display = 'none';
        loadMoreBtn.disabled = true;
        endOfResultsMessage.style.display = 'block'; // Show end message
        endOfResultsMessage.setAttribute('aria-hidden', 'false');
    }

    isLoading = false;
    // Optional: Hide loading indicator
}


/**
 * Opens the IC details modal and populates it with data.
 * @param {Object} ic - The IC object to display details for.
 */
function openModal(ic) {
    // Populate basic details
    modalICNumber.textContent = ic.number;
    modalFunction.textContent = ic.function;
    modalDescription.textContent = ic.description || 'No description available.';

    // --- Handle Connection Diagram ---
    // Clear previous content and hide all related elements initially
    modalConnectionDiagram.innerHTML = '';
    modalConnectionSection.style.display = 'none';
    modalConnectionSection.setAttribute('aria-hidden', 'true');
    connDiagramNA.style.display = 'none';
    connDiagramNA.setAttribute('aria-hidden', 'true');


    if (ic.hasConnectionDiagram) {
        modalConnectionSection.style.display = 'flex';
        modalConnectionSection.setAttribute('aria-hidden', 'false');

        const connDiagramImg = document.createElement('img');
        const imageUrl = `images/${ic.number}C.png`;
        connDiagramImg.src = imageUrl;
        connDiagramImg.alt = `${ic.number} Connection Diagram`;

        connDiagramImg.onload = function() {
             connDiagramImg.addEventListener('click', () => openImageModal(imageUrl, `${ic.number} Connection Diagram`));
             modalConnectionDiagram.appendChild(connDiagramImg);
        };

        connDiagramImg.onerror = function() {
            modalConnectionDiagram.innerHTML = '';
            connDiagramNA.style.display = 'block';
            connDiagramNA.setAttribute('aria-hidden', 'false');
            console.warn(`Connection diagram image not found for ${ic.number}: ${imageUrl}`);
        };

    }

    // --- Handle Function Table ---
     // Clear previous content and hide all related elements initially
    modalFunctionTable.innerHTML = '';
    modalFunctionSection.style.display = 'none';
    modalFunctionSection.setAttribute('aria-hidden', 'true');
    funcTableNA.style.display = 'none';
    funcTableNA.setAttribute('aria-hidden', 'true');


    if (ic.hasFunctionTable) {
        modalFunctionSection.style.display = 'flex';
        modalFunctionSection.setAttribute('aria-hidden', 'false');

        const funcTableImg = document.createElement('img');
        const imageUrl = `images/${ic.number}F.png`;
        funcTableImg.src = imageUrl;
        funcTableImg.alt = `${ic.number} Function Table`;

        funcTableImg.onload = function() {
            funcTableImg.addEventListener('click', () => openImageModal(imageUrl, `${ic.number} Function Table`));
            modalFunctionTable.appendChild(funcTableImg);
        };

         funcTableImg.onerror = function() {
            modalFunctionTable.innerHTML = '';
            funcTableNA.style.display = 'block';
            funcTableNA.setAttribute('aria-hidden', 'false');
             console.warn(`Function table image not found for ${ic.number}: ${imageUrl}`);
        };

    }

    // --- Handle Datasheet Link ---
    if (ic.datasheetLink && isValidUrl(ic.datasheetLink)) {
        modalDatasheetLink.href = ic.datasheetLink;
        modalDatasheetLink.style.display = 'inline-block';
        modalDatasheetLink.setAttribute('aria-hidden', 'false');
        modalDatasheetNA.style.display = 'none';
         modalDatasheetNA.setAttribute('aria-hidden', 'true');

    } else {
        modalDatasheetLink.style.display = 'none';
        modalDatasheetLink.setAttribute('aria-hidden', 'true');
        modalDatasheetNA.style.display = 'inline';
        modalDatasheetNA.setAttribute('aria-hidden', 'false');
         if (ic.datasheetLink) {
             console.warn(`Invalid datasheet URL for ${ic.number}: ${ic.datasheetLink}`);
         }
    }


    // Show the modal
    modal.style.display = 'block';
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // Prevent scrolling the background
    // Trap focus inside the modal for accessibility
    trapFocus(modal);
}

/**
 * Closes the IC details modal.
 */
function closeModal() {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = 'auto'; // Restore scrolling
    // Remove focus trap
    releaseFocus();
}

/**
 * Opens the image enlargement modal.
 * @param {string} imgSrc - The source URL of the image to display.
 * @param {string} imgAlt - The alt text for the image.
 */
function openImageModal(imgSrc, imgAlt) {
    enlargedImage.src = imgSrc;
    enlargedImage.alt = imgAlt;
    imageModal.style.display = 'flex';
    imageModal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    // Trap focus inside the image modal
     trapFocus(imageModal);
}

/**
 * Closes the image enlargement modal.
 */
function closeImageModal() {
    imageModal.style.display = 'none';
    imageModal.setAttribute('aria-hidden', 'true');
    enlargedImage.src = '';
    enlargedImage.alt = '';
    document.body.style.overflow = 'auto';
    // Remove focus trap
     releaseFocus();
}


/**
 * Closes the modals if the user clicks outside of them.
 * @param {Event} e - The click event.
 */
function outsideClick(e) {
    if (e.target === modal) {
        closeModal();
    }
    if (e.target === imageModal) {
        closeImageModal();
    }
}

/**
 * Closes the modals if the Escape key is pressed.
 * @param {KeyboardEvent} e - The keyboard event.
 */
function escapeKeyClose(e) {
    if (e.key === 'Escape') {
        if (imageModal.style.display === 'flex') {
            closeImageModal();
        } else if (modal.style.display === 'block') {
            closeModal();
        }
    }
}

/**
 * Basic URL validation.
 * @param {string} url - The URL string to validate.
 * @returns {boolean} True if the URL is valid, false otherwise.
 */
function isValidUrl(url) {
    try {
        // Use a more robust check for http/https protocols
        const parsedUrl = new URL(url);
        return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch (e) {
        return false;
    }
}

/**
 * Shows the appropriate status message and hides others.
 * @param {string} type - The type of message to show ('loading', 'error', 'no-results').
 */
function showStatusMessage(type) {
    loadingMessage.style.display = 'none';
    loadingMessage.setAttribute('aria-hidden', 'true');
    errorMessage.style.display = 'none';
    errorMessage.setAttribute('aria-hidden', 'true');
    noResultsMessage.style.display = 'none';
    noResultsMessage.setAttribute('aria-hidden', 'true');
    loadMoreBtn.style.display = 'none'; // Hide load more button
    loadMoreBtn.disabled = true;
    endOfResultsMessage.style.display = 'none'; // Hide end message
    endOfResultsMessage.setAttribute('aria-hidden', 'true');


    if (type === 'loading') {
        loadingMessage.style.display = 'block';
        loadingMessage.setAttribute('aria-hidden', 'false');
    } else if (type === 'error') {
        errorMessage.style.display = 'block';
        errorMessage.setAttribute('aria-hidden', 'false');
    } else if (type === 'no-results') {
        noResultsMessage.style.display = 'block';
        noResultsMessage.setAttribute('aria-hidden', 'false');
    }
}

/**
 * Hides all status messages.
 */
function hideStatusMessages() {
    loadingMessage.style.display = 'none';
    loadingMessage.setAttribute('aria-hidden', 'true');
    errorMessage.style.display = 'none';
    errorMessage.setAttribute('aria-hidden', 'true');
    noResultsMessage.style.display = 'none';
    noResultsMessage.setAttribute('aria-hidden', 'true');
     // Note: loadMoreBtn and endOfResultsMessage are handled by applyFilterAndSearch and loadMoreICs
}


// --- Back to Top Button Functionality ---
/**
 * Shows or hides the back to top button based on scroll position.
 */
function handleScroll() {
    if (document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) {
        backToTopBtn.style.display = 'block';
    } else {
        backToTopBtn.style.display = 'none';
    }
}

/**
 * Smoothly scrolls the page to the top.
 */
function scrollToTop() {
    window.scrollTo({
        top: 0,
        behavior: 'smooth' // Smooth scrolling animation
    });
}


// --- Accessibility: Focus Trapping ---
let focusableElements = [];
let firstFocusableElement = null;
let lastFocusableElement = null;
let previouslyActiveElement = null;

/**
 * Traps focus inside a given element (modal).
 * @param {Element} element - The element to trap focus within.
 */
function trapFocus(element) {
    previouslyActiveElement = document.activeElement; // Store previously focused element

    // Get all focusable elements within the modal
    focusableElements = element.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusableElement = focusableElements[0];
    lastFocusableElement = focusableElements[focusableElements.length - 1];

    // Add event listener for trapping focus
    element.addEventListener('keydown', handleTrapFocus);

    // Focus the first focusable element inside the modal
    // Use requestAnimationFrame for better timing after modal display
    requestAnimationFrame(() => {
         firstFocusableElement && firstFocusableElement.focus();
    });

}

/**
 * Handles keyboard events for focus trapping.
 * @param {KeyboardEvent} e - The keyboard event.
 */
function handleTrapFocus(e) {
    const isTabPressed = (e.key === 'Tab');

    if (!isTabPressed) {
        return; // Don't do anything if not a tab key
    }

    if (e.shiftKey) { // if shift key pressed for shift + tab
        if (document.activeElement === firstFocusableElement) {
            lastFocusableElement.focus(); // add focus to the last focusable element
            e.preventDefault();
        }
    } else { // if tab key is pressed
        if (document.activeElement === lastFocusableElement) {
            firstFocusableElement.focus(); // add focus to the first focusable element
            e.preventDefault();
        }
    }
}

/**
 * Releases focus trap and returns focus to the element that was focused before the modal opened.
 */
function releaseFocus() {
     // Remove event listener from both modals (safer)
     modal.removeEventListener('keydown', handleTrapFocus);
     imageModal.removeEventListener('keydown', handleTrapFocus);

     // Return focus to where it was before the modal opened
     if (previouslyActiveElement) {
         previouslyActiveElement.focus();
         previouslyActiveElement = null; // Clear the stored element
     }
}
