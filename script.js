// Global variables
let icData = [];
let filteredData = [];

// DOM elements
const icContainer = document.getElementById('icContainer');
const searchInput = document.getElementById('searchInput');
const filterButtons = document.querySelectorAll('.filter-btn');
const modal = document.getElementById('icModal');
const closeBtn = document.querySelector('.close');

// Modal elements
const modalICNumber = document.getElementById('modalICNumber');
const modalFunction = document.getElementById('modalFunction');
const modalDescription = document.getElementById('modalDescription');
const modalConnectionDiagram = document.getElementById('modalConnectionDiagram');
const modalFunctionTable = document.getElementById('modalFunctionTable');
const modalDatasheetLink = document.getElementById('modalDatasheetLink');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Load and parse the CSV data
    fetch('ics.csv')
        .then(response => response.text())
        .then(csvData => {
            icData = parseCSV(csvData);
            filteredData = [...icData];
            renderICCards(filteredData);
        })
        .catch(error => {
            console.error('Error loading CSV file:', error);
            // Display error message to user
            icContainer.innerHTML = '<p class="error">Error loading IC data. Please try again later.</p>';
        });

    // Set up event listeners
    searchInput.addEventListener('input', handleSearch);
    filterButtons.forEach(button => {
        button.addEventListener('click', handleFilter);
    });
    closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', outsideClick);
});

// Parse CSV data into an array of objects
function parseCSV(csv) {
    const lines = csv.split('\n');
    const headers = lines[0].split(',').map(header => header.trim());
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const obj = {};
        const currentline = lines[i].split(',');
        
        // Skip empty rows or section headers
        if (currentline.length < 2 || currentline[1].trim() === '') continue;
        
        // Handle description fields that might contain commas
        let description = '';
        if (currentline.length > 3) {
            // Check if the description field has extra commas
            if (currentline[3].startsWith('"') && !currentline[3].endsWith('"')) {
                // Find where the description ends
                let j = 3;
                description = currentline[j];
                while (!description.endsWith('"') && j < currentline.length - 1) {
                    j++;
                    description += ',' + currentline[j];
                }
                // Remove surrounding quotes
                description = description.replace(/^"|"$/g, '');
                // Adjust the currentline array
                currentline.splice(3, j - 2, description);
            } else {
                description = currentline[3].replace(/^"|"$/g, '');
            }
        }
        
        // Create the IC object
        const ic = {
            number: currentline[1].trim(),
            function: currentline[2].trim(),
            description: description.trim(),
            hasConnectionDiagram: currentline[4] && currentline[4].trim().toLowerCase() === 'yes',
            hasFunctionTable: currentline[5] && currentline[5].trim().toLowerCase() === 'yes',
            datasheetLink: currentline[6] ? currentline[6].trim() : ''
        };
        
        // Only add if it has an IC number
        if (ic.number) {
            // Determine IC family (TTL or CMOS)
            ic.family = ic.number.startsWith('74') ? 'ttl' : 'cmos';
            result.push(ic);
        }
    }
    
    return result;
}

// Render IC cards to the DOM
function renderICCards(ics) {
    icContainer.innerHTML = '';
    
    if (ics.length === 0) {
        icContainer.innerHTML = '<p class="no-results">No ICs found matching your criteria.</p>';
        return;
    }
    
    ics.forEach(ic => {
        const card = document.createElement('div');
        card.className = 'ic-card';
        card.dataset.number = ic.number;
        
        card.innerHTML = `
            <div class="ic-card-header">
                <h3>${ic.number}</h3>
                <p>${ic.function}</p>
            </div>
            <div class="ic-card-body">
                <p>${ic.description.substring(0, 150)}${ic.description.length > 150 ? '...' : ''}</p>
            </div>
        `;
        
        card.addEventListener('click', () => openModal(ic));
        icContainer.appendChild(card);
    });
}

// Handle search functionality
function handleSearch() {
    const searchTerm = searchInput.value.toLowerCase();
    
    filteredData = icData.filter(ic => {
        return ic.number.toLowerCase().includes(searchTerm) || 
               ic.function.toLowerCase().includes(searchTerm) ||
               ic.description.toLowerCase().includes(searchTerm);
    });
    
    renderICCards(filteredData);
}

// Handle filter buttons
function handleFilter(e) {
    const filter = e.target.dataset.filter;
    
    // Update active button
    filterButtons.forEach(button => {
        button.classList.remove('active');
    });
    e.target.classList.add('active');
    
    // Apply filter
    if (filter === 'all') {
        filteredData = [...icData];
    } else {
        filteredData = icData.filter(ic => ic.family === filter);
    }
    
    // Re-apply search if there's a search term
    if (searchInput.value) {
        const searchTerm = searchInput.value.toLowerCase();
        filteredData = filteredData.filter(ic => {
            return ic.number.toLowerCase().includes(searchTerm) || 
                   ic.function.toLowerCase().includes(searchTerm) ||
                   ic.description.toLowerCase().includes(searchTerm);
        });
    }
    
    renderICCards(filteredData);
}

// Open modal with IC details
function openModal(ic) {
    modalICNumber.textContent = ic.number;
    modalFunction.textContent = ic.function;
    modalDescription.textContent = ic.description;
    
    // Set up connection diagram
    if (ic.hasConnectionDiagram) {
        modalConnectionDiagram.innerHTML = `<img src="images/${ic.number}C.png" alt="${ic.number} Connection Diagram" onerror="this.parentElement.innerHTML='<p class=\\'not-available\\'>Image not available</p>'">`;
    } else {
        modalConnectionDiagram.innerHTML = '<p class="not-available">Not available</p>';
    }
    
    // Set up function table
    if (ic.hasFunctionTable) {
        modalFunctionTable.innerHTML = `<img src="images/${ic.number}F.png" alt="${ic.number} Function Table" onerror="this.parentElement.innerHTML='<p class=\\'not-available\\'>Image not available</p>'">`;
    } else {
        modalFunctionTable.innerHTML = '<p class="not-available">Not available</p>';
    }
    
    // Set up datasheet link
    if (ic.datasheetLink) {
        modalDatasheetLink.href = ic.datasheetLink;
        modalDatasheetLink.style.display = 'inline-block';
    } else {
        modalDatasheetLink.style.display = 'none';
    }
    
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

// Close modal
function closeModal() {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

// Close modal when clicking outside
function outsideClick(e) {
    if (e.target === modal) {
        closeModal();
    }
}