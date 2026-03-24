document.addEventListener('DOMContentLoaded', function() {
    const dataTable = document.getElementById('skillsTable').getElementsByTagName('tbody')[0];
    const addBtn = document.getElementById('addSkillBtn');
    const dataModal = document.getElementById('skillModal');
    const deleteModal = document.getElementById('deleteModal');
    const closeModal = document.getElementById('closeModal');
    const closeDeleteModal = document.getElementById('closeDeleteModal');
    const cancelDelete = document.getElementById('cancelDelete');
    const confirmDelete = document.getElementById('confirmDelete');
    const dataForm = document.getElementById('skillForm');
    const modalTitle = document.getElementById('modalTitle');
    const floatingMessage = document.getElementById('floatingMessage');
    const searchInput = document.getElementById('searchInput');

    let originalData = [];
    let currentId = null;

    if (!localStorage.getItem('accessToken')) {
        window.location.href = '/login';
    }

    loadData();

    addBtn.addEventListener('click', () => {
        currentId = null;
        modalTitle.textContent = 'Add Skill';
        dataForm.reset();
        document.getElementById('is_visible').checked = true;
        document.getElementById('display_order').value = 0;
        dataModal.classList.remove('hidden');
    });

    closeModal.addEventListener('click', () => dataModal.classList.add('hidden'));
    closeDeleteModal.addEventListener('click', () => deleteModal.classList.add('hidden'));
    cancelDelete.addEventListener('click', () => deleteModal.classList.add('hidden'));

    searchInput.addEventListener('input', debounce(() => {
        const query = searchInput.value.trim().toLowerCase();
        if (query) {
            const filtered = originalData.filter(item => 
                (item.name || '').toLowerCase().includes(query) || 
                (item.category || '').toLowerCase().includes(query)
            );
            renderData(filtered);
        } else {
            renderData(originalData);
        }
    }, 500));

    dataForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const formData = {
            name: document.getElementById('name').value.trim(),
            category: document.getElementById('category').value.trim() || null,
            icon_code: document.getElementById('icon_code').value.trim() || null,
            display_order: parseInt(document.getElementById('display_order').value) || 0,
            is_visible: document.getElementById('is_visible').checked
        };

        if (!formData.name) {
            showMessage('Skill name is required', 'error');
            return;
        }

        if (currentId) {
            updateData(currentId, formData);
        } else {
            createData(formData);
        }
    });

    confirmDelete.addEventListener('click', function() {
        if (currentId) deleteData(currentId);
    });

    async function fetchWithToken(url, options = {}) {
        const accessToken = localStorage.getItem('accessToken');
        options.headers = {
            ...options.headers,
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        };

        try {
            const response = await fetch(url, options);
            if (response.status === 401) {
                const refreshed = await refreshAccessToken();
                if (refreshed) {
                    options.headers.Authorization = `Bearer ${localStorage.getItem('accessToken')}`;
                    return await fetch(url, options);
                } else {
                    window.location.href = '/login';
                    return null;
                }
            }
            return response;
        } catch (err) {
            console.error('Fetch error:', err);
            showMessage('An error occurred. Please try again.', 'error');
            return null;
        }
    }

    async function refreshAccessToken() {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) return false;

        try {
            const response = await fetch('/api/v1/refresh-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken })
            });
            const data = await response.json();
            if (data.error) {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                return false;
            }
            localStorage.setItem('accessToken', data.token);
            localStorage.setItem('refreshToken', data.refreshToken);
            return true;
        } catch (err) {
            console.error('Refresh token error:', err);
            return false;
        }
    }

    async function loadData() {
        const response = await fetchWithToken('/api/v1/settings/skills');
        if (!response) return;

        if(response.status === 404) {
             renderData([]);
             return;
        }

        const data = await response.json();
        if (data.error) {
            showMessage(data.message, 'error');
            renderData([]);
            return;
        }
        originalData = data.data;
        renderData(data.data);
    }

    function renderData(items) {
        dataTable.innerHTML = '';
        if (!items || items.length === 0) {
            const row = dataTable.insertRow();
            const cell = row.insertCell(0);
            cell.colSpan = 6;
            cell.textContent = 'No skills found';
            cell.className = 'text-center py-4 text-black';
            return;
        }

        items.forEach((item, index) => {
            const row = dataTable.insertRow();

            const idCell = row.insertCell(0);
            idCell.textContent = index + 1;
            idCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-black';
            idCell.setAttribute('data-label', 'ID');

            const nameCell = row.insertCell(1);
            nameCell.textContent = item.name;
            nameCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-black font-medium';
            nameCell.setAttribute('data-label', 'Name');

            const catCell = row.insertCell(2);
            catCell.textContent = item.category || '-';
            catCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-gray-600';
            catCell.setAttribute('data-label', 'Category');

            const displayorderCell = row.insertCell(3);
            displayorderCell.textContent = item.display_order || '-';
            displayorderCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-gray-600';
            displayorderCell.setAttribute('data-label', 'displayorder');

            const visCell = row.insertCell(4);
            visCell.innerHTML = item.is_visible ? '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Yes</span>' : '<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">No</span>';
            visCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-gray-600';
            visCell.setAttribute('data-label', 'Visible');

            const actionsCell = row.insertCell(5);
            actionsCell.className = 'px-4 py-2 whitespace-nowrap text-sm text-black text-right';
            actionsCell.setAttribute('data-label', 'Actions');

            const actionButtons = document.createElement('div');
            actionButtons.className = 'flex justify-end gap-2';
            
            const editBtn = document.createElement('button');
            editBtn.innerHTML = '<i class="fas fa-edit"></i>';
            editBtn.className = 'bg-yellow-500 hover:bg-yellow-600 text-white rounded px-2 py-1';
            editBtn.addEventListener('click', () => editDataItem(item.id));

            const deleteBtn = document.createElement('button');
            deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
            deleteBtn.className = 'bg-red-500 hover:bg-red-600 text-white rounded px-2 py-1';
            deleteBtn.addEventListener('click', () => confirmDeleteData(item.id));

            actionButtons.appendChild(editBtn);
            actionButtons.appendChild(deleteBtn);
            actionsCell.appendChild(actionButtons);
        });
    }

    async function createData(postData) {
        const response = await fetchWithToken('/api/v1/settings/skills', {
            method: 'POST',
            body: JSON.stringify(postData)
        });
        if (!response) return;

        const data = await response.json();
        if (data.error) {
            showMessage(data.message || data.error, 'error');
            return;
        }
        showMessage('Successfully added', 'success');
        dataModal.classList.add('hidden');
        loadData();
    }

    async function editDataItem(id) {
        const response = await fetchWithToken(`/api/v1/settings/skills/${id}`);
        if (!response) return;

        const data = await response.json();
        if (data.error) {
            showMessage(data.message, 'error');
            return;
        }
        const itemData = data.data;
        currentId = id;
        modalTitle.textContent = 'Edit Skill';
        
        document.getElementById('name').value = itemData.name || '';
        document.getElementById('category').value = itemData.category || '';
        document.getElementById('icon_code').value = itemData.icon_code || '';
        document.getElementById('display_order').value = itemData.display_order || 0;
        document.getElementById('is_visible').checked = itemData.is_visible;
        
        dataModal.classList.remove('hidden');
    }

    async function updateData(id, putData) {
        const response = await fetchWithToken(`/api/v1/settings/skills/${id}`, {
            method: 'PUT',
            body: JSON.stringify(putData)
        });
        if (!response) return;

        const data = await response.json();
        if (data.error) {
            showMessage(data.message || data.error, 'error');
            return;
        }
        showMessage('Successfully updated', 'success');
        dataModal.classList.add('hidden');
        loadData();
    }

    function confirmDeleteData(id) {
        currentId = id;
        deleteModal.classList.remove('hidden');
    }

    async function deleteData(id) {
        const response = await fetchWithToken(`/api/v1/settings/skills/${id}`, {
            method: 'DELETE'
        });
        if (!response) return;

        const data = await response.json();
        if (data.error) {
            showMessage(data.message, 'error');
            return;
        }
        showMessage('Successfully deleted', 'success');
        deleteModal.classList.add('hidden');
        loadData();
    }

    function showMessage(message, type) {
        floatingMessage.textContent = message;
        floatingMessage.className = `floating-message ${type} show`;
        setTimeout(() => {
            floatingMessage.classList.remove('show');
            setTimeout(() => {
                floatingMessage.textContent = '';
                floatingMessage.className = 'floating-message';
            }, 300);
        }, 3000);
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
});
