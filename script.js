let goals = JSON.parse(localStorage.getItem('goals') || '[]');
let editingGoalId = null;
let activeGoalsChartInstance;
let boughtItemsChartInstance;
let currentPageActive = 1;
let currentPageArchive = 1;
const itemsPerPage = 6;

// --- Modal Functions ---
function openModal(modalId) {
    document.getElementById(modalId).classList.add('show');
    // Reset form when opening for adding new goal
    if (modalId === 'addGoalModal') {
        document.getElementById('goalForm').reset();
        document.getElementById('submitBtn').textContent = '➕ Add Goal';
        editingGoalId = null; // Ensure we are in "add" mode
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// --- Hamburger Menu Function ---
function toggleMenu() {
    const headerButtons = document.getElementById('headerButtons');
    headerButtons.classList.toggle('show');
}

function updateAvailableBalanceAndDashboard() {
    const balanceInput = document.getElementById('availableBalance');
    localStorage.setItem('availableBalance', balanceInput.value);
    renderGoals();
}

function populateArchiveDateFilters() {
    const archiveFilterYearSelect = document.getElementById('archiveFilterYear');
    const archiveFilterMonthSelect = document.getElementById('archiveFilterMonth');

    const currentYearSelection = archiveFilterYearSelect.value;
    const currentMonthSelection = archiveFilterMonthSelect.value;

    archiveFilterYearSelect.innerHTML = '<option value="">All Years</option>';
    archiveFilterMonthSelect.innerHTML = '<option value="">All Months</option>';

    // Add current year and a few future years initially for selection
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year <= currentYear + 5; year++) {
        const option = document.createElement('option');
        option.value = year.toString();
        option.textContent = year.toString();
        archiveFilterYearSelect.appendChild(option);
    }

    // Add unique years from existing purchased items
    const uniqueYearsFromData = new Set();
    goals.filter(g => g.purchased && g.purchasedAt).forEach(g => {
        const purchaseDate = new Date(g.purchasedAt);
        const year = purchaseDate.getFullYear().toString();
        uniqueYearsFromData.add(year);
    });

    Array.from(uniqueYearsFromData).sort().forEach(year => {
        if (!archiveFilterYearSelect.querySelector(`option[value="${year}"]`)) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            archiveFilterYearSelect.appendChild(option);
        }
    });

    const monthNames = ["January", "February", "March", "April", "May", "June",
                        "July", "August", "September", "October", "November", "December"];
    for (let i = 1; i <= 12; i++) {
        const monthValue = i.toString().padStart(2, '0');
        const option = document.createElement('option');
        option.value = monthValue;
        option.textContent = monthNames[i - 1];
        archiveFilterMonthSelect.appendChild(option);
    }

    // Restore previous selections
    archiveFilterYearSelect.value = currentYearSelection;
    archiveFilterMonthSelect.value = currentMonthSelection;
}

document.getElementById('goalForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const name = goalName.value;
    const amount = +goalAmount.value;
    const note = goalNote.value;
    const category = goalCategory.value;
    const file = goalImage.files[0];

    const updateGoal = (imageData = '') => {
        if (editingGoalId) {
            const goal = goals.find(g => g.id === editingGoalId);
            if (goal) {
                goal.name = name;
                goal.amount = amount;
                goal.note = note;
                goal.category = category;
                if (imageData) goal.image = imageData;
            }
            editingGoalId = null;
            document.getElementById('submitBtn').textContent = '➕ Add Goal';
        } else {
            const newGoal = {
                id: Date.now(),
                name, amount, note, category,
                image: imageData,
                purchased: false,
                createdAt: new Date().toISOString()
            };
            goals.push(newGoal);
        }
        localStorage.setItem('goals', JSON.stringify(goals));
        goalForm.reset();
        renderGoals();
        closeModal('addGoalModal'); // Close the modal after submission
    };

    if (file) {
        const reader = new FileReader();
        reader.onload = () => updateGoal(reader.result);
        reader.readAsDataURL(file);
    } else {
        updateGoal();
    }
});

function renderGoals() {
    const list = document.getElementById('goalList');
    const archive = document.getElementById('archiveList');
    list.innerHTML = '';
    archive.innerHTML = '';

    // --- Active Goals Logic ---
    const search = document.getElementById('searchBar').value.toLowerCase();
    const filter = document.getElementById('filterCategory').value;
    const sort = document.getElementById('sortBy').value;

    let activeGoals = goals.filter(g => !g.purchased);

    let filteredActiveGoals = activeGoals.filter(g => {
        const match = g.name.toLowerCase().includes(search) || g.note.toLowerCase().includes(search);
        const inCategory = !filter || g.category === filter;
        return match && inCategory;
    });

    if (sort === 'newest') filteredActiveGoals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (sort === 'oldest') filteredActiveGoals.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    if (sort === 'highest') filteredActiveGoals.sort((a, b) => b.amount - a.amount);
    if (sort === 'lowest') filteredActiveGoals.sort((a, b) => a.amount - b.amount);

    let totalNeeded = 0;
    let activeCategoryMap = {};

    filteredActiveGoals.forEach(goal => {
        totalNeeded += goal.amount;
        activeCategoryMap[goal.category] = (activeCategoryMap[goal.category] || 0) + goal.amount;
    });

    const totalPagesActive = Math.ceil(filteredActiveGoals.length / itemsPerPage);
    if (currentPageActive > totalPagesActive && totalPagesActive > 0) currentPageActive = totalPagesActive;
    if (totalPagesActive === 0) currentPageActive = 1;

    const startActive = (currentPageActive - 1) * itemsPerPage;
    const paginatedActiveGoals = filteredActiveGoals.slice(startActive, startActive + itemsPerPage);

    paginatedActiveGoals.forEach(goal => {
        const card = document.createElement('div');
        card.className = 'goal';
        card.innerHTML = `
            <img src="${goal.image || 'https://via.placeholder.com/180x180?text=No+Image'}" onclick="zoomImage(this)" alt="${goal.name}" />
            <h4>${goal.name}</h4>
            <p><strong>Amount:</strong> GHS ${goal.amount.toFixed(2)}</p>
            <p><strong>Category:</strong> ${goal.category}</p>
            <p>${goal.note}</p>
            <div class="goal-actions">
                <button onclick="markPurchased(${goal.id})">✔️ Bought</button>
                <button onclick="editGoal(${goal.id})">✏️ Edit</button>
                <button onclick="deleteGoal(${goal.id})">🗑️ Delete</button>
            </div>`;
        list.appendChild(card);
    });

    // --- Dashboard Updates (Based on Active Goals) ---
    document.getElementById('totalGoals').textContent = filteredActiveGoals.length;
    document.getElementById('totalNeeded').textContent = 'GHS ' + totalNeeded.toFixed(2);

    const balance = +document.getElementById('availableBalance').value || 0;
    let calculatedShortfall = 0;
    let calculatedSurplus = 0;

    if (totalNeeded > balance) {
        calculatedShortfall = totalNeeded - balance;
    } else {
        calculatedSurplus = balance - totalNeeded;
    }

    document.getElementById('shortfall').textContent = 'GHS ' + calculatedShortfall.toFixed(2);
    document.getElementById('surplus').textContent = 'GHS ' + calculatedSurplus.toFixed(2);

    document.getElementById('pageInfoActive').textContent = `Page ${currentPageActive} of ${totalPagesActive || 1}`;


    // --- Bought Archive Logic ---
    populateArchiveDateFilters();

    const archiveSearchBar = document.getElementById('archiveSearchBar').value.toLowerCase();
    const archiveFilterCategory = document.getElementById('archiveFilterCategory').value;
    const archiveSortBy = document.getElementById('archiveSortBy').value;
    const archiveFilterYear = document.getElementById('archiveFilterYear').value;
    const archiveFilterMonth = document.getElementById('archiveFilterMonth').value;

    let archivedGoals = goals.filter(g => g.purchased);

    archivedGoals = archivedGoals.filter(g => {
        const match = g.name.toLowerCase().includes(archiveSearchBar) || g.note.toLowerCase().includes(archiveSearchBar);
        return match;
    });

    if (archiveFilterCategory) {
        archivedGoals = archivedGoals.filter(g => g.category === archiveFilterCategory);
    }

    if (archiveFilterYear) {
        archivedGoals = archivedGoals.filter(g => {
            const purchaseDate = new Date(g.purchasedAt);
            return purchaseDate.getFullYear().toString() === archiveFilterYear;
        });
    }
    if (archiveFilterMonth) {
        archivedGoals = archivedGoals.filter(g => {
            const purchaseDate = new Date(g.purchasedAt);
            return (purchaseDate.getMonth() + 1).toString().padStart(2, '0') === archiveFilterMonth;
        });
    }

    if (archiveSortBy === 'newest_bought') archivedGoals.sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt));
    else if (archiveSortBy === 'oldest_bought') archivedGoals.sort((a, b) => new Date(a.purchasedAt) - new Date(b.purchasedAt));
    else if (archiveSortBy === 'highest') archivedGoals.sort((a, b) => b.amount - a.amount);
    else if (archiveSortBy === 'lowest') archivedGoals.sort((a, b) => a.amount - b.amount);

    let boughtCategoryMap = {};
    archivedGoals.forEach(goal => {
        boughtCategoryMap[goal.category] = (boughtCategoryMap[goal.category] || 0) + goal.amount;
    });

    const totalPagesArchive = Math.ceil(archivedGoals.length / itemsPerPage);
    if (currentPageArchive > totalPagesArchive && totalPagesArchive > 0) currentPageArchive = totalPagesArchive;
    if (totalPagesArchive === 0) currentPageArchive = 1;

    const startArchive = (currentPageArchive - 1) * itemsPerPage;
    const paginatedArchiveGoals = archivedGoals.slice(startArchive, startArchive + itemsPerPage);

    paginatedArchiveGoals.forEach(goal => {
        const card = document.createElement('div');
        card.className = 'goal';
        const purchaseDateDisplay = goal.purchasedAt ? new Date(goal.purchasedAt).toLocaleDateString() : 'N/A';
        card.innerHTML = `
            <img src="${goal.image || 'https://via.placeholder.com/180x180?text=No+Image'}" onclick="zoomImage(this)" alt="${goal.name}" />
            <h4>${goal.name}</h4>
            <p><strong>Amount:</strong> GHS ${goal.amount.toFixed(2)}</p>
            <p><strong>Category:</strong> ${goal.category}</p>
            <p>${goal.note}</p>
            <p><strong>Purchased On:</strong> ${purchaseDateDisplay}</p>
            <div class="goal-actions">
                <button onclick="deleteGoal(${goal.id})">🗑️ Delete</button>
            </div>`;
        archive.appendChild(card);
    });

    document.getElementById('pageInfoArchive').textContent = `Page ${currentPageArchive} of ${totalPagesArchive || 1}`;

    // --- Chart Update Logic for UI Display ---
    const activeGoalsSection = document.getElementById('activeGoalsSection');
    const archiveSection = document.getElementById('archiveSection');

    const activeGoalsChartCanvas = document.getElementById('activeGoalsChart');
    const boughtItemsChartCanvas = document.getElementById('boughtItemsChart');

    if (activeGoalsSection.style.display !== 'none') {
        updateChart(activeGoalsChartCanvas, activeCategoryMap, 'Active Goals Breakdown by Category', 'activeGoalsChartInstance');
        document.getElementById('activeGoalsChartWrapper').style.display = 'block';
    } else {
        if (activeGoalsChartInstance) activeGoalsChartInstance.destroy();
        document.getElementById('activeGoalsChartWrapper').style.display = 'none';
    }

    if (archiveSection.style.display !== 'none') {
        updateChart(boughtItemsChartCanvas, boughtCategoryMap, 'Bought Items Breakdown by Category', 'boughtItemsChartInstance');
        document.getElementById('boughtItemsChartWrapper').style.display = 'block';
    } else {
        if (boughtItemsChartInstance) boughtItemsChartInstance.destroy();
        document.getElementById('boughtItemsChartWrapper').style.display = 'none';
    }

    document.querySelector('#activeGoalsSection .pagination').style.display = activeGoalsSection.style.display;
    document.querySelector('#archiveSection .pagination').style.display = archiveSection.style.display;
}

function prevPage(type) {
    if (type === 'active') {
        const search = document.getElementById('searchBar').value.toLowerCase();
        const filter = document.getElementById('filterCategory').value;
        let activeGoals = goals.filter(g => !g.purchased);
        let filteredActiveGoals = activeGoals.filter(g => {
            const match = g.name.toLowerCase().includes(search) || g.note.toLowerCase().includes(search);
            const inCategory = !filter || g.category === filter;
            return match && inCategory;
        });
        const totalPages = Math.ceil(filteredActiveGoals.length / itemsPerPage);

        if (currentPageActive > 1) {
            currentPageActive--;
            renderGoals();
        }
    } else if (type === 'archive') {
        const archiveSearchBar = document.getElementById('archiveSearchBar').value.toLowerCase();
        const archiveFilterCategory = document.getElementById('archiveFilterCategory').value;
        const archiveFilterYear = document.getElementById('archiveFilterYear').value;
        const archiveFilterMonth = document.getElementById('archiveFilterMonth').value;

        let archivedGoals = goals.filter(g => g.purchased);
        archivedGoals = archivedGoals.filter(g => {
            const match = g.name.toLowerCase().includes(archiveSearchBar) || g.note.toLowerCase().includes(archiveSearchBar);
            const inCategory = !archiveFilterCategory || g.category === archiveFilterCategory;
            let dateMatch = true;
            if (archiveFilterYear && g.purchasedAt) {
                dateMatch = new Date(g.purchasedAt).getFullYear().toString() === archiveFilterYear;
            }
            if (dateMatch && archiveFilterMonth && g.purchasedAt) {
                dateMatch = (new Date(g.purchasedAt).getMonth() + 1).toString().padStart(2, '0') === archiveFilterMonth;
            }
            return match && inCategory && dateMatch;
        });
        const totalPages = Math.ceil(archivedGoals.length / itemsPerPage);

        if (currentPageArchive > 1) {
            currentPageArchive--;
            renderGoals();
        }
    }
}

function nextPage(type) {
    if (type === 'active') {
        const search = document.getElementById('searchBar').value.toLowerCase();
        const filter = document.getElementById('filterCategory').value;
        let activeGoals = goals.filter(g => !g.purchased);
        let filteredActiveGoals = activeGoals.filter(g => {
            const match = g.name.toLowerCase().includes(search) || g.note.toLowerCase().includes(search);
            const inCategory = !filter || g.category === filter;
            return match && inCategory;
        });
        const totalPages = Math.ceil(filteredActiveGoals.length / itemsPerPage);

        if (currentPageActive < totalPages) {
            currentPageActive++;
            renderGoals();
        }
    } else if (type === 'archive') {
        const archiveSearchBar = document.getElementById('archiveSearchBar').value.toLowerCase();
        const archiveFilterCategory = document.getElementById('archiveFilterCategory').value;
        const archiveFilterYear = document.getElementById('archiveFilterYear').value;
        const archiveFilterMonth = document.getElementById('archiveFilterMonth').value;

        let archivedGoals = goals.filter(g => g.purchased);
        archivedGoals = archivedGoals.filter(g => {
            const match = g.name.toLowerCase().includes(archiveSearchBar) || g.note.toLowerCase().includes(archiveSearchBar);
            const inCategory = !archiveFilterCategory || g.category === archiveFilterCategory;
            let dateMatch = true;
            if (archiveFilterYear && g.purchasedAt) {
                dateMatch = new Date(g.purchasedAt).getFullYear().toString() === archiveFilterYear;
            }
            if (dateMatch && archiveFilterMonth && g.purchasedAt) {
                dateMatch = (new Date(g.purchasedAt).getMonth() + 1).toString().padStart(2, '0') === archiveFilterMonth;
            }
            return match && inCategory && dateMatch;
        });
        const totalPages = Math.ceil(archivedGoals.length / itemsPerPage);

        if (currentPageArchive < totalPages) {
            currentPageArchive++;
            renderGoals();
        }
    }
}

function updateChart(canvasElement, dataMap, title, instanceName) {
    if (window[instanceName]) {
        window[instanceName].destroy();
    }

    const labels = Object.keys(dataMap);
    const data = Object.values(dataMap);

    if (labels.length === 0) {
        canvasElement.style.display = 'none';
        return;
    } else {
        canvasElement.style.display = 'block';
    }

    window[instanceName] = new Chart(canvasElement, {
        type: 'pie',
        data: {
            labels,
            datasets: [{
                label: 'Goal Amounts',
                data,
                backgroundColor: [
                    '#2b6777', '#f4a261', '#e76f51',
                    '#52ab98', '#264653', '#8ecae6',
                    '#ffb703', '#e63946', '#a8dadc',
                    '#4CAF50', '#FFC107'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: true,
                    text: title,
                    font: {
                        size: 18
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed !== null) {
                                label += 'GHS ' + context.parsed.toFixed(2);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

async function createChartImage(dataMap, title) {
    if (Object.keys(dataMap).length === 0) {
        return null;
    }
    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = 500;
    offscreenCanvas.height = 300;
    const ctx = offscreenCanvas.getContext('2d');

    return new Promise(resolve => {
        const tempChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(dataMap),
                datasets: [{
                    label: 'Goal Amounts',
                    data: Object.values(dataMap),
                    backgroundColor: [
                        '#2b6777', '#f4a261', '#e76f51',
                        '#52ab98', '#264653', '#8ecae6',
                        '#ffb703', '#e63946', '#a8dadc',
                        '#4CAF50', '#FFC107'
                    ]
                }]
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: title,
                        font: {
                            size: 18
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                let label = context.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed !== null) {
                                    label += 'GHS ' + context.parsed.toFixed(2);
                                }
                                return label;
                            }
                        }
                    }
                },
                animation: {
                    onComplete: () => {
                        resolve(offscreenCanvas.toDataURL('image/png'));
                        tempChart.destroy();
                    }
                }
            }
        });
    });
}

function markPurchased(id) {
    const goal = goals.find(g => g.id === id);
    if (goal) {
        goal.purchased = true;
        goal.purchasedAt = new Date().toISOString();

        let currentBalance = +document.getElementById('availableBalance').value || 0;
        currentBalance -= goal.amount;
        document.getElementById('availableBalance').value = currentBalance.toFixed(2);
        localStorage.setItem('availableBalance', currentBalance.toFixed(2));

        localStorage.setItem('goals', JSON.stringify(goals));
        renderGoals();
    }
}

function editGoal(id) {
    const goal = goals.find(g => g.id === id);
    if (goal) {
        editingGoalId = id;
        document.getElementById('goalName').value = goal.name;
        document.getElementById('goalAmount').value = goal.amount;
        document.getElementById('goalNote').value = goal.note;
        document.getElementById('goalCategory').value = goal.category;
        // Note: Image input cannot be pre-filled for security reasons
        document.getElementById('submitBtn').textContent = 'Save Changes';
        openModal('addGoalModal'); // Open the modal for editing
    }
}

function deleteGoal(id) {
    if (confirm('Are you sure you want to delete this goal?')) {
        goals = goals.filter(g => g.id !== id);
        localStorage.setItem('goals', JSON.stringify(goals));
        renderGoals();
    }
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
}

function toggleActiveGoals() {
    const section = document.getElementById('activeGoalsSection');
    const isHidden = section.style.display === 'none';
    section.style.display = isHidden ? 'block' : 'none';
    localStorage.setItem('activeGoalsSectionHidden', !isHidden);
    renderGoals();
}

function toggleArchive() {
    const section = document.getElementById('archiveSection');
    const isHidden = section.style.display === 'none';
    section.style.display = isHidden ? 'block' : 'none';
    localStorage.setItem('archiveSectionHidden', !isHidden);
    renderGoals();
}

async function generatePDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 10;
    const margin = 10;
    const pageHeight = doc.internal.pageSize.height;

    doc.setFontSize(20);
    doc.text('Goal Tracker Report', doc.internal.pageSize.width / 2, y, { align: 'center' });
    y += 20;

    doc.setFontSize(16);
    doc.text('Active Goals', margin, y);
    y += 10;

    const search = document.getElementById('searchBar').value.toLowerCase();
    const filter = document.getElementById('filterCategory').value;
    const sort = document.getElementById('sortBy').value;

    let activeGoalsForReport = goals.filter(g => !g.purchased);
    activeGoalsForReport = activeGoalsForReport.filter(g => {
        const match = g.name.toLowerCase().includes(search) || g.note.toLowerCase().includes(search);
        const inCategory = !filter || g.category === filter;
        return match && inCategory;
    });

    if (sort === 'newest') activeGoalsForReport.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (sort === 'oldest') activeGoalsForReport.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    if (sort === 'highest') activeGoalsForReport.sort((a, b) => b.amount - a.amount);
    if (sort === 'lowest') activeGoalsForReport.sort((a, b) => a.amount - b.amount);

    if (activeGoalsForReport.length === 0) {
        doc.setFontSize(10);
        doc.text('No active goals found matching criteria.', margin + 5, y);
        y += 10;
    } else {
        doc.setFontSize(10);
        activeGoalsForReport.forEach((g, i) => {
            if (y + 20 > pageHeight - margin) {
                doc.addPage();
                y = margin;
            }
            doc.text(`- ${g.name} (GHS ${g.amount.toFixed(2)}) - Category: ${g.category}`, margin, y);
            y += 5;
            doc.text(`   Note: ${g.note || 'N/A'}`, margin + 5, y);
            y += 8;
        });
    }
    y += 10;

    doc.setFontSize(16);
    if (y + 10 > pageHeight - margin) {
        doc.addPage();
        y = margin;
    }
    doc.text('Bought Items', margin, y);
    y += 10;

    const archiveSearchBar = document.getElementById('archiveSearchBar').value.toLowerCase();
    const archiveFilterCategory = document.getElementById('archiveFilterCategory').value;
    const archiveSortBy = document.getElementById('archiveSortBy').value;
    const archiveFilterYear = document.getElementById('archiveFilterYear').value;
    const archiveFilterMonth = document.getElementById('archiveFilterMonth').value;

    let archivedGoalsForReport = goals.filter(g => g.purchased);

    archivedGoalsForReport = archivedGoalsForReport.filter(g => {
        const match = g.name.toLowerCase().includes(archiveSearchBar) || g.note.toLowerCase().includes(archiveSearchBar);
        const inCategory = !archiveFilterCategory || g.category === archiveFilterCategory;
        let dateMatch = true;
        if (archiveFilterYear && g.purchasedAt) {
            dateMatch = new Date(g.purchasedAt).getFullYear().toString() === archiveFilterYear;
        }
        if (dateMatch && archiveFilterMonth && g.purchasedAt) {
            dateMatch = (new Date(g.purchasedAt).getMonth() + 1).toString().padStart(2, '0') === archiveFilterMonth;
        }
        return match && inCategory && dateMatch;
    });

    if (archiveSortBy === 'newest_bought') archivedGoalsForReport.sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt));
    else if (archiveSortBy === 'oldest_bought') archivedGoalsForReport.sort((a, b) => new Date(a.purchasedAt) - new Date(b.purchasedAt));
    else if (archiveSortBy === 'highest') archivedGoalsForReport.sort((a, b) => b.amount - a.amount);
    else if (archiveSortBy === 'lowest') archivedGoalsForReport.sort((a, b) => a.amount - b.amount);


    if (archivedGoalsForReport.length === 0) {
        doc.setFontSize(10);
        doc.text('No bought items found matching criteria.', margin + 5, y);
        y += 10;
    } else {
        doc.setFontSize(10);
        archivedGoalsForReport.forEach((g, i) => {
            if (y + 20 > pageHeight - margin) {
                doc.addPage();
                y = margin;
            }
            const purchaseDateDisplay = g.purchasedAt ? new Date(g.purchasedAt).toLocaleDateString() : 'N/A';
            doc.text(`- ${g.name} (GHS ${g.amount.toFixed(2)}) - Category: ${g.category} (Bought on: ${purchaseDateDisplay})`, margin, y);
            y += 5;
            doc.text(`   Note: ${g.note || 'N/A'}`, margin + 5, y);
            y += 8;
        });
    }
    y += 10;

    let activeCategoryMapForPdf = {};
    goals.filter(g => !g.purchased).forEach(goal => {
        activeCategoryMapForPdf[goal.category] = (activeCategoryMapForPdf[goal.category] || 0) + goal.amount;
    });

    const activeChartImg = await createChartImage(activeCategoryMapForPdf, 'Active Goals Breakdown by Category');
    if (activeChartImg) {
        if (y + 120 > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }
        doc.setFontSize(14);
        doc.text('Active Goals Category Breakdown', margin, y);
        y += 5;
        doc.addImage(activeChartImg, 'PNG', margin, y, 180, 100);
        y += 110;
    }

    let boughtCategoryMapForPdf = {};
    goals.filter(g => g.purchased).forEach(goal => {
        boughtCategoryMapForPdf[goal.category] = (boughtCategoryMapForPdf[goal.category] || 0) + goal.amount;
    });

    const boughtChartImg = await createChartImage(boughtCategoryMapForPdf, 'Bought Items Breakdown by Category');
    if (boughtChartImg) {
        if (y + 120 > pageHeight - margin) {
            doc.addPage();
            y = margin;
        }
        doc.setFontSize(14);
        doc.text('Bought Items Category Breakdown', margin, y);
        y += 5;
        doc.addImage(boughtChartImg, 'PNG', margin, y, 180, 100);
        y += 110;
    }

    doc.save('goal-report.pdf');
}

async function exportCSV() {
    const rows = [];
    const delimiter = ',';

    rows.push(['--- Active Goals ---']);
    rows.push(['Name', 'Amount', 'Category', 'Note', 'Date Created']);

    const search = document.getElementById('searchBar').value.toLowerCase();
    const filter = document.getElementById('filterCategory').value;
    const sort = document.getElementById('sortBy').value;

    let activeGoalsForCSV = goals.filter(g => !g.purchased);
    activeGoalsForCSV = activeGoalsForCSV.filter(g => {
        const match = g.name.toLowerCase().includes(search) || g.note.toLowerCase().includes(search);
        const inCategory = !filter || g.category === filter;
        return match && inCategory;
    });

    if (sort === 'newest') activeGoalsForCSV.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (sort === 'oldest') activeGoalsForCSV.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    if (sort === 'highest') activeGoalsForCSV.sort((a, b) => b.amount - a.amount);
    if (sort === 'lowest') activeGoalsForCSV.sort((a, b) => a.amount - b.amount);

    activeGoalsForCSV.forEach(g => {
        rows.push([
            g.name,
            g.amount.toFixed(2),
            g.category,
            g.note.replace(/"/g, '""'),
            new Date(g.createdAt).toLocaleDateString()
        ]);
    });

    rows.push([]);

    rows.push(['--- Bought Items ---']);
    rows.push(['Name', 'Amount', 'Category', 'Note', 'Date Created', 'Date Purchased']);

    const archiveSearchBar = document.getElementById('archiveSearchBar').value.toLowerCase();
    const archiveFilterCategory = document.getElementById('archiveFilterCategory').value;
    const archiveSortBy = document.getElementById('archiveSortBy').value;
    const archiveFilterYear = document.getElementById('archiveFilterYear').value;
    const archiveFilterMonth = document.getElementById('archiveFilterMonth').value;

    let archivedGoalsForCSV = goals.filter(g => g.purchased);

    archivedGoalsForCSV = archivedGoalsForCSV.filter(g => {
        const match = g.name.toLowerCase().includes(archiveSearchBar) || g.note.toLowerCase().includes(archiveSearchBar);
        const inCategory = !archiveFilterCategory || g.category === archiveFilterCategory;
        let dateMatch = true;
        if (archiveFilterYear && g.purchasedAt) {
            dateMatch = new Date(g.purchasedAt).getFullYear().toString() === archiveFilterYear;
        }
        if (dateMatch && archiveFilterMonth && g.purchasedAt) {
            dateMatch = (new Date(g.purchasedAt).getMonth() + 1).toString().padStart(2, '0') === archiveFilterMonth;
        }
        return match && inCategory && dateMatch;
    });

    if (archiveSortBy === 'newest_bought') archivedGoalsForCSV.sort((a, b) => new Date(b.purchasedAt) - new Date(a.purchasedAt));
    else if (archiveSortBy === 'oldest_bought') archivedGoalsForCSV.sort((a, b) => new Date(a.purchasedAt) - new Date(b.purchasedAt));
    else if (archiveSortBy === 'highest') archivedGoalsForCSV.sort((a, b) => b.amount - a.amount);
    else if (archiveSortBy === 'lowest') archivedGoalsForCSV.sort((a, b) => a.amount - b.amount);

    archivedGoalsForCSV.forEach(g => {
        rows.push([
            g.name,
            g.amount.toFixed(2),
            g.category,
            g.note.replace(/"/g, '""'),
            new Date(g.createdAt).toLocaleDateString(),
            g.purchasedAt ? new Date(g.purchasedAt).toLocaleDateString() : ''
        ]);
    });

    const csvContent = rows.map(r => r.map(field => `"${String(field).replace(/"/g, '""')}"`).join(delimiter)).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'goals_report.csv';
    link.click();
}

function zoomImage(img) {
    const previewOverlay = document.getElementById('previewOverlay');
    const previewImage = document.getElementById('previewImage');
    previewImage.src = img.src;
    previewOverlay.classList.add('show');
}

function closePreview() {
    document.getElementById('previewOverlay').classList.remove('show');
}

window.onload = () => {
    const savedGoals = localStorage.getItem('goals');
    if (savedGoals) {
        goals = JSON.parse(savedGoals);
    }

    const savedBalance = localStorage.getItem('availableBalance');
    if (savedBalance !== null) {
        document.getElementById('availableBalance').value = savedBalance;
    }

    document.getElementById('searchBar').value = localStorage.getItem('searchBar') || '';
    document.getElementById('filterCategory').value = localStorage.getItem('filterCategory') || '';
    document.getElementById('sortBy').value = localStorage.getItem('sortBy') || 'newest';

    document.getElementById('archiveSearchBar').value = localStorage.getItem('archiveSearchBar') || '';
    document.getElementById('archiveFilterCategory').value = localStorage.getItem('archiveFilterCategory') || '';
    document.getElementById('archiveFilterYear').value = localStorage.getItem('archiveFilterYear') || '';
    document.getElementById('archiveFilterMonth').value = localStorage.getItem('archiveFilterMonth') || '';
    document.getElementById('archiveSortBy').value = localStorage.getItem('archiveSortBy') || 'newest_bought';

    const activeGoalsSectionHidden = localStorage.getItem('activeGoalsSectionHidden') === 'true';
    document.getElementById('activeGoalsSection').style.display = activeGoalsSectionHidden ? 'none' : 'block';

    const archiveSectionHidden = localStorage.getItem('archiveSectionHidden') === 'true';
    document.getElementById('archiveSection').style.display = archiveSectionHidden ? 'none' : 'block';

    renderGoals();
};

document.getElementById('searchBar').addEventListener('input', () => localStorage.setItem('searchBar', document.getElementById('searchBar').value));
document.getElementById('filterCategory').addEventListener('change', () => localStorage.setItem('filterCategory', document.getElementById('filterCategory').value));
document.getElementById('sortBy').addEventListener('change', () => localStorage.setItem('sortBy', document.getElementById('sortBy').value));

document.getElementById('archiveSearchBar').addEventListener('input', () => localStorage.setItem('archiveSearchBar', document.getElementById('archiveSearchBar').value));
document.getElementById('archiveFilterCategory').addEventListener('change', () => localStorage.setItem('archiveFilterCategory', document.getElementById('archiveFilterCategory').value));
document.getElementById('archiveFilterYear').addEventListener('change', () => localStorage.setItem('archiveFilterYear', document.getElementById('archiveFilterYear').value));
document.getElementById('archiveFilterMonth').addEventListener('change', () => localStorage.setItem('archiveFilterMonth', document.getElementById('archiveFilterMonth').value));
document.getElementById('archiveSortBy').addEventListener('change', () => localStorage.setItem('archiveSortBy', document.getElementById('archiveSortBy').value));